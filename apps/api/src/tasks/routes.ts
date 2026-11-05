import { Prisma, TaskStatus, TaskUpdateKind } from "@prisma/client";
import { Router } from "express";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { createBullMqNotificationQueue } from "../notifications/queue.js";
import { createCalendarSyncQueue } from "../integrations/google-calendar-queue.js";
import { taskAssignedEvent } from "../notifications/jobs.js";
import { requirePolicy } from "../policy/policy.js";
import { PolicyDeniedError } from "../policy/policy.js";
import { attachmentUpload, saveAttachment } from "./attachments.js";
import { parseDriveLinkInput } from "./drive-links.js";
import {
  isOverdue,
  normalizeStatusChange,
  parseMentionTokens,
  parseTaskCommentInput,
  parseTaskCreationInput,
  parseTaskListFilters,
  validateStatusChange,
} from "./service.js";

const taskInclude = {
  assignee: {
    include: {
      membership: { include: { user: { select: { id: true, name: true } } } },
    },
  },
  createdBy: {
    include: {
      membership: { include: { user: { select: { id: true, name: true } } } },
    },
  },
  team: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

const updateInclude = {
  author: {
    include: {
      membership: { include: { user: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.TaskUpdateInclude;

function parseStatus(value: unknown): TaskStatus | undefined {
  return Object.values(TaskStatus).find((status) => status === value);
}

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

export function createTasksRouter() {
  const notificationQueue = process.env.REDIS_URL
    ? createBullMqNotificationQueue(process.env.REDIS_URL)
    : null;
  const calendarSyncQueue = process.env.REDIS_URL
    ? createCalendarSyncQueue(process.env.REDIS_URL)
    : null;
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const parsedFilters = parseTaskListFilters(request.query);
      if ("error" in parsedFilters) {
        response.status(400).json({
          code: "invalid_task_filter",
          message: parsedFilters.error,
        });
        return;
      }
      const { filters } = parsedFilters;
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + (7 - now.getDay()));
      const tasks = await prisma.task.findMany({
        where: {
          deletedAt: null,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.assigneeEmployeeId
            ? { assigneeEmployeeId: filters.assigneeEmployeeId }
            : {}),
          ...(filters.open || filters.dueThisWeek || filters.overdue
            ? { status: { not: TaskStatus.done } }
            : {}),
          ...(filters.overdue ? { dueAt: { lt: now } } : {}),
          ...(filters.dueThisWeek ? { dueAt: { gte: now, lte: weekEnd } } : {}),
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
      const parsed = parseTaskCreationInput(request.body ?? {});
      if ("error" in parsed) {
        response.status(400).json({
          code: "invalid_task",
          message: parsed.error,
        });
        return;
      }
      const { input } = parsed;
      const assignee = await prisma.employee.findFirst({
        where: {
          id: input.assigneeEmployeeId,
          status: "active",
          deletedAt: null,
        },
        select: { id: true, membership: { select: { userId: true } } },
      });
      if (!assignee) {
        response.status(400).json({
          code: "invalid_assignee",
          message: "The assignee must be an active employee in this company.",
        });
        return;
      }
      if (input.teamId) {
        const team = await prisma.team.findFirst({
          where: {
            id: input.teamId,
            members: { some: { employeeId: input.assigneeEmployeeId } },
          },
          select: { id: true },
        });
        if (!team) {
          response.status(400).json({
            code: "invalid_team",
            message: "The team must exist in this company and include the assignee.",
          });
          return;
        }
      }

      await requirePolicy("tasks.create", {
        targetEmployeeId: input.assigneeEmployeeId,
      });
      if (input.assigneeEmployeeId !== (await actorEmployeeId())) {
        await requirePolicy("tasks.assign", {
          targetEmployeeId: input.assigneeEmployeeId,
        });
      }
      const createdByEmployeeId = await actorEmployeeId();
      const task = await prisma.task.create({
        data: {
          companyId: requireCompanyId(),
          title: input.title,
          description: input.description,
          assigneeEmployeeId: input.assigneeEmployeeId,
          createdByEmployeeId,
          teamId: input.teamId,
          priority: input.priority,
          dueAt: input.dueAt,
        },
        include: taskInclude,
      });
      if (notificationQueue) {
        await notificationQueue.enqueue({
          event: taskAssignedEvent({
            companyId: requireCompanyId(),
            recipientUserId: assignee.membership.userId,
            taskId: task.id,
            payload: { title: task.title, dueAt: task.dueAt },
          }),
        });
      }
      if (calendarSyncQueue && task.dueAt) {
        await calendarSyncQueue.enqueue({
          companyId: requireCompanyId(),
          taskId: task.id,
          operation: "upsert",
        });
      }
      await writeActivity("task.created", task.id, {
        title: task.title,
        assigneeEmployeeId: input.assigneeEmployeeId,
      });
      response.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:taskId/comments/drive-links", async (request, response, next) => {
    try {
      const parsed = parseDriveLinkInput(request.body ?? {});
      if ("error" in parsed) {
        response
          .status(400)
          .json({ code: "invalid_drive_link", message: parsed.error });
        return;
      }
      const task = await prisma.task.findFirst({
        where: {
          id: Array.isArray(request.params.taskId)
            ? request.params.taskId[0]
            : request.params.taskId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!task) {
        response
          .status(404)
          .json({ code: "task_not_found", message: "Task not found." });
        return;
      }
      await requirePolicy("tasks.update", { targetTaskId: task.id });
      const update = await prisma.taskUpdate.create({
        data: {
          companyId: requireCompanyId(),
          taskId: task.id,
          authorEmployeeId: await actorEmployeeId(),
          kind: TaskUpdateKind.comment,
          body: parsed.input.name,
        },
        include: updateInclude,
      });
      const attachment = await prisma.attachment.create({
        data: {
          companyId: requireCompanyId(),
          taskUpdateId: update.id,
          kind: "drive_link",
          name: parsed.input.name,
          url: parsed.input.url,
          driveFileId: parsed.input.driveFileId,
          mimeType: parsed.input.mimeType,
        },
      });
      await writeActivity("task.drive_link_added", task.id, {
        updateId: update.id,
        attachmentId: attachment.id,
        driveFileId: parsed.input.driveFileId,
      });
      response.status(201).json({ update, attachment });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/:taskId/comments/attachments",
    attachmentUpload.single("file"),
    async (request, response, next) => {
      try {
        const parsed = parseTaskCommentInput(request.body ?? {});
        if ("error" in parsed) {
          response.status(400).json({ code: "invalid_comment", message: parsed.error });
          return;
        }
        if (!request.file) {
          response.status(400).json({
            code: "invalid_attachment",
            message: "An attachment file is required.",
          });
          return;
        }
        const task = await prisma.task.findFirst({
          where: {
            id: Array.isArray(request.params.taskId)
              ? request.params.taskId[0]
              : request.params.taskId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!task) {
          response
            .status(404)
            .json({ code: "task_not_found", message: "Task not found." });
          return;
        }
        await requirePolicy("tasks.update", { targetTaskId: task.id });
        const stored = await saveAttachment(request.file);
        const update = await prisma.taskUpdate.create({
          data: {
            companyId: requireCompanyId(),
            taskId: task.id,
            authorEmployeeId: await actorEmployeeId(),
            kind: TaskUpdateKind.comment,
            body: parsed.body,
          },
          include: updateInclude,
        });
        const attachment = await prisma.attachment.create({
          data: {
            companyId: requireCompanyId(),
            taskUpdateId: update.id,
            kind: "upload",
            name: stored.name,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
          },
        });
        await writeActivity("task.attachment_added", task.id, {
          updateId: update.id,
          attachmentId: attachment.id,
          mentions: parseMentionTokens(parsed.body),
        });
        response.status(201).json({ update, attachment });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get("/:taskId", async (request, response, next) => {
    try {
      const task = await prisma.task.findFirst({
        where: {
          id: Array.isArray(request.params.taskId)
            ? request.params.taskId[0]
            : request.params.taskId,
          deletedAt: null,
        },
        include: {
          ...taskInclude,
          updates: { orderBy: { createdAt: "asc" }, include: updateInclude },
        },
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

  router.delete("/:taskId", async (request, response, next) => {
    try {
      const taskId = Array.isArray(request.params.taskId)
        ? request.params.taskId[0]
        : request.params.taskId;
      const task = await prisma.task.findFirst({
        where: { id: taskId, deletedAt: null },
        select: { id: true },
      });
      if (!task) {
        response
          .status(404)
          .json({ code: "task_not_found", message: "Task not found." });
        return;
      }
      await requirePolicy("tasks.update", { targetTaskId: task.id });
      await prisma.task.update({
        where: { id_companyId: { id: task.id, companyId: requireCompanyId() } },
        data: { deletedAt: new Date() },
      });
      await writeActivity("task.deleted", task.id, {});
      if (calendarSyncQueue)
        await calendarSyncQueue.enqueue({
          companyId: requireCompanyId(),
          taskId: task.id,
          operation: "remove",
        });
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:taskId", async (request, response, next) => {
    try {
      if (!Object.prototype.hasOwnProperty.call(request.body ?? {}, "dueAt")) {
        response.status(400).json({
          code: "invalid_task_update",
          message: "dueAt is required.",
        });
        return;
      }

      const taskId = Array.isArray(request.params.taskId)
        ? request.params.taskId[0]
        : request.params.taskId;
      const existing = await prisma.task.findFirst({
        where: { id: taskId, deletedAt: null },
        select: { id: true, dueAt: true },
      });
      if (!existing) {
        response.status(404).json({
          code: "task_not_found",
          message: "Task not found.",
        });
        return;
      }
      await requirePolicy("tasks.update", { targetTaskId: existing.id });

      const rawDueAt = request.body?.dueAt;
      let dueAt: Date | null = null;
      if (rawDueAt !== null) {
        if (typeof rawDueAt !== "string" || !rawDueAt.trim()) {
          response.status(400).json({
            code: "invalid_due_date",
            message: "dueAt must be a valid ISO date or null.",
          });
          return;
        }
        dueAt = new Date(rawDueAt);
        if (Number.isNaN(dueAt.getTime())) {
          response.status(400).json({
            code: "invalid_due_date",
            message: "dueAt must be a valid ISO date or null.",
          });
          return;
        }
      }

      const task = await prisma.task.update({
        where: { id_companyId: { id: existing.id, companyId: requireCompanyId() } },
        data: { dueAt },
        include: taskInclude,
      });
      await writeActivity("task.due_date_changed", task.id, {
        before: existing.dueAt?.toISOString() ?? null,
        after: dueAt?.toISOString() ?? null,
      });
      if (calendarSyncQueue) {
        await calendarSyncQueue.enqueue({
          companyId: requireCompanyId(),
          taskId: task.id,
          operation: dueAt ? "upsert" : "remove",
        });
      }
      response.json({ task });
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
      const statusValidationError = validateStatusChange({
        status,
        blockedReason: request.body?.blockedReason,
      });
      if (statusValidationError) {
        response.status(400).json({
          code: "invalid_status_change",
          message: statusValidationError,
        });
        return;
      }
      const existing = await prisma.task.findFirst({
        where: {
          id: Array.isArray(request.params.taskId)
            ? request.params.taskId[0]
            : request.params.taskId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          blockedReason: true,
          assigneeEmployeeId: true,
        },
      });
      if (!existing) {
        response
          .status(404)
          .json({ code: "task_not_found", message: "Task not found." });
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
        include: updateInclude,
      });
      await writeActivity("task.status_changed", task.id, {
        from: existing.status,
        to: normalized.status,
        blockedReason: normalized.blockedReason,
      });
      if (calendarSyncQueue && normalized.status === TaskStatus.done) {
        await calendarSyncQueue.enqueue({
          companyId: requireCompanyId(),
          taskId: task.id,
          operation: "remove",
        });
      }
      response.json({ task, update });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:taskId/comments", async (request, response, next) => {
    try {
      const parsed = parseTaskCommentInput(request.body ?? {});
      if ("error" in parsed) {
        response.status(400).json({
          code: "invalid_comment",
          message: parsed.error,
        });
        return;
      }
      const task = await prisma.task.findFirst({
        where: {
          id: Array.isArray(request.params.taskId)
            ? request.params.taskId[0]
            : request.params.taskId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!task) {
        response
          .status(404)
          .json({ code: "task_not_found", message: "Task not found." });
        return;
      }
      await requirePolicy("tasks.update", { targetTaskId: task.id });
      const update = await prisma.taskUpdate.create({
        data: {
          companyId: requireCompanyId(),
          taskId: task.id,
          authorEmployeeId: await actorEmployeeId(),
          kind: TaskUpdateKind.comment,
          body: parsed.body,
        },
        include: updateInclude,
      });
      await writeActivity("task.comment_added", task.id, {
        updateId: update.id,
        mentions: parseMentionTokens(parsed.body),
      });
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
