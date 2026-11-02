import {
  Prisma,
  TaskPriority,
  TaskStatus,
  TaskUpdateKind,
} from "@prisma/client";
import { Router } from "express";
import {
  getActorUserId,
  requireCompanyId,
} from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { requirePolicy } from "../policy/policy.js";
import { PolicyDeniedError } from "../policy/policy.js";
import { isOverdue, normalizeStatusChange } from "./service.js";

const taskInclude = {
  assignee: {
    include: { membership: { include: { user: { select: { id: true, name: true } } } } },
  },
  createdBy: {
    include: { membership: { include: { user: { select: { id: true, name: true } } } } },
  },
  team: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

function actorId(): string {
  const userId = getActorUserId();
  if (!userId) {
    throw new Error("An authenticated actor is required.");
  }
  return userId;
}

async function actorEmployeeId(): Promise<string> {
  const membership = await prisma.membership.findUnique({
    where: {
      companyId_userId: {
        companyId: requireCompanyId(),
        userId: actorId(),
      },
    },
    select: { employee: { select: { id: true } } },
  });
  if (!membership?.employee) {
    throw new Error("The authenticated actor has no employee profile.");
  }
  return membership.employee.id;
}

async function writeActivity(
  action: string,
  entityId: string,
  metadata: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      companyId: requireCompanyId(),
      actorUserId: actorId(),
      action,
      entityType: "task",
      entityId,
      metadata,
    },
  });
}

function parsePriority(value: unknown): TaskPriority | undefined {
  return Object.values(TaskPriority).find((priority) => priority === value);
}

function parseStatus(value: unknown): TaskStatus | undefined {
  return Object.values(TaskStatus).find((status) => status === value);
}

function parseDueAt(value: unknown): Date | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function createTasksRouter() {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const tasks = await prisma.task.findMany({
        where: {
          deletedAt: null,
          ...(parseStatus(request.query.status)
            ? { status: parseStatus(request.query.status) }
            : {}),
          ...(parsePriority(request.query.priority)
            ? { priority: parsePriority(request.query.priority) }
            : {}),
          ...(typeof request.query.assigneeEmployeeId === "string"
            ? { assigneeEmployeeId: request.query.assigneeEmployeeId }
            : {}),
        },
        include: taskInclude,
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      });
      const visible = [];
      for (const task of tasks) {
        if (await canViewTask(task.id)) {
          visible.push({
            ...task,
            overdue: isOverdue(task.dueAt, task.status),
          });
        }
      }
      response.json({ tasks: visible });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const title =
        typeof request.body?.title === "string" ? request.body.title.trim() : "";
      const assigneeEmployeeId =
        typeof request.body?.assigneeEmployeeId === "string"
          ? request.body.assigneeEmployeeId
          : "";
      const dueAt = parseDueAt(request.body?.dueAt);
      const priority = parsePriority(request.body?.priority) ?? TaskPriority.medium;
      if (!title || !assigneeEmployeeId || dueAt === undefined) {
        response.status(400).json({
          code: "invalid_task",
          message: "title and assigneeEmployeeId are required; dueAt must be a valid date when provided.",
        });
        return;
      }

      await requirePolicy("tasks.create", { targetEmployeeId: assigneeEmployeeId });
      if (assigneeEmployeeId !== (await actorEmployeeId())) {
        await requirePolicy("tasks.assign", {
          targetEmployeeId: assigneeEmployeeId,
        });
      }
      const createdByEmployeeId = await actorEmployeeId();
      const task = await prisma.task.create({
        data: {
          companyId: requireCompanyId(),
          title,
          description:
            typeof request.body?.description === "string"
              ? request.body.description.trim() || null
              : null,
          assigneeEmployeeId,
          createdByEmployeeId,
          teamId:
            typeof request.body?.teamId === "string" ? request.body.teamId : null,
          priority,
          dueAt,
        },
        include: taskInclude,
      });
      await writeActivity("task.created", task.id, {
        title: task.title,
        assigneeEmployeeId,
      });
      response.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:taskId", async (request, response, next) => {
    try {
      const task = await prisma.task.findFirst({
        where: { id: request.params.taskId, deletedAt: null },
        include: { ...taskInclude, updates: { orderBy: { createdAt: "asc" } } },
      });
      if (!task || !(await canViewTask(task.id))) {
        response.status(404).json({
          code: "task_not_found",
          message: "Task not found.",
        });
        return;
      }
      response.json({ task, overdue: isOverdue(task.dueAt, task.status) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:taskId/status", async (request, response, next) => {
    try {
      const status = parseStatus(request.body?.status);
      if (!status) {
        response.status(400).json({
          code: "invalid_status",
          message: "status must be todo, in_progress, blocked, or done.",
        });
        return;
      }
      const existing = await prisma.task.findFirst({
        where: { id: request.params.taskId, deletedAt: null },
        select: { id: true, status: true, blockedReason: true, assigneeEmployeeId: true },
      });
      if (!existing) {
        response.status(404).json({ code: "task_not_found", message: "Task not found." });
        return;
      }
      await requirePolicy("tasks.update", { targetTaskId: existing.id });
      const normalized = normalizeStatusChange({
        status,
        blockedReason: request.body?.blockedReason,
      });
      const task = await prisma.task.update({
        where: { id_companyId: { id: existing.id, companyId: requireCompanyId() } },
        data: {
          status: normalized.status,
          blockedReason: normalized.blockedReason,
          completedAt: normalized.status === TaskStatus.done ? new Date() : null,
        },
        include: taskInclude,
      });
      const update = await prisma.taskUpdate.create({
        data: {
          companyId: requireCompanyId(),
          taskId: task.id,
          authorEmployeeId: await actorEmployeeId(),
          kind: TaskUpdateKind.status_change,
          body:
            normalized.status === TaskStatus.blocked
              ? `Status changed to blocked: ${normalized.blockedReason}`
              : `Status changed to ${normalized.status}.`,
        },
      });
      await writeActivity("task.status_changed", task.id, {
        from: existing.status,
        to: normalized.status,
        blockedReason: normalized.blockedReason,
      });
      response.json({ task, update });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:taskId/comments", async (request, response, next) => {
    try {
      const body = typeof request.body?.body === "string" ? request.body.body.trim() : "";
      if (!body) {
        response.status(400).json({
          code: "invalid_comment",
          message: "Comment body is required.",
        });
        return;
      }
      const task = await prisma.task.findFirst({
        where: { id: request.params.taskId, deletedAt: null },
        select: { id: true },
      });
      if (!task) {
        response.status(404).json({ code: "task_not_found", message: "Task not found." });
        return;
      }
      await requirePolicy("tasks.update", { targetTaskId: task.id });
      const update = await prisma.taskUpdate.create({
        data: {
          companyId: requireCompanyId(),
          taskId: task.id,
          authorEmployeeId: await actorEmployeeId(),
          kind: TaskUpdateKind.comment,
          body,
        },
      });
      await writeActivity("task.comment_added", task.id, { updateId: update.id });
      response.status(201).json({ update });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function canViewTask(taskId: string): Promise<boolean> {
  try {
    await requirePolicy("tasks.view", { targetTaskId: taskId });
    return true;
  } catch (error) {
    if (error instanceof PolicyDeniedError) {
      return false;
    }
    throw error;
  }
}
