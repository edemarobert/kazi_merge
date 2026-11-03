import { TaskPriority, TaskStatus } from "@prisma/client";

export type TaskCreationInput = {
  title: string;
  description: string | null;
  assigneeEmployeeId: string;
  teamId: string | null;
  priority: TaskPriority;
  dueAt: Date | null;
};

export type TaskCreationPayload = {
  title?: unknown;
  description?: unknown;
  assigneeEmployeeId?: unknown;
  teamId?: unknown;
  priority?: unknown;
  dueAt?: unknown;
};

export function parseTaskCreationInput(
  payload: TaskCreationPayload,
): { input: TaskCreationInput } | { error: string } {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const assigneeEmployeeId =
    typeof payload.assigneeEmployeeId === "string"
      ? payload.assigneeEmployeeId.trim()
      : "";
  if (!title || !assigneeEmployeeId) {
    return { error: "title and assigneeEmployeeId are required." };
  }
  if (title.length > 200) {
    return { error: "title must be 200 characters or fewer." };
  }

  const priority =
    payload.priority === undefined
      ? TaskPriority.medium
      : Object.values(TaskPriority).find((value) => value === payload.priority);
  if (!priority) {
    return { error: "priority must be low, medium, or high." };
  }

  let dueAt: Date | null = null;
  if (payload.dueAt !== undefined && payload.dueAt !== null && payload.dueAt !== "") {
    if (typeof payload.dueAt !== "string") {
      return { error: "dueAt must be a valid ISO date." };
    }
    dueAt = new Date(payload.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      return { error: "dueAt must be a valid ISO date." };
    }
  }

  return {
    input: {
      title,
      description:
        typeof payload.description === "string"
          ? payload.description.trim() || null
          : null,
      assigneeEmployeeId,
      teamId: typeof payload.teamId === "string" ? payload.teamId.trim() || null : null,
      priority,
      dueAt,
    },
  };
}

export type TaskStatusChange = {
  status: TaskStatus;
  blockedReason?: unknown;
};

export function validateStatusChange({
  status,
  blockedReason,
}: TaskStatusChange): string | null {
  if (
    blockedReason !== undefined &&
    blockedReason !== null &&
    typeof blockedReason !== "string"
  ) {
    return "blockedReason must be text.";
  }
  const reason = typeof blockedReason === "string" ? blockedReason.trim() : "";
  if (status === TaskStatus.blocked && !reason) {
    return "A blocked task must include a reason.";
  }
  if (reason.length > 500) {
    return "blockedReason must be 500 characters or fewer.";
  }
  return null;
}

export function normalizeStatusChange({ status, blockedReason }: TaskStatusChange): {
  status: TaskStatus;
  blockedReason: string | null;
} {
  const error = validateStatusChange({ status, blockedReason });
  if (error) {
    throw new Error(error);
  }
  return {
    status,
    blockedReason:
      status === TaskStatus.blocked && typeof blockedReason === "string"
        ? blockedReason.trim()
        : null,
  };
}

export function isOverdue(
  dueAt: Date | null,
  status: TaskStatus,
  now = new Date(),
): boolean {
  return Boolean(dueAt && dueAt < now && status !== TaskStatus.done);
}
