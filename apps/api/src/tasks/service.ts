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
export function parseMentionTokens(body: string): string[] {
  const mentions = new Set<string>();
  for (const match of body.matchAll(/@([a-zA-Z0-9._+-]{2,64})/g)) {
    mentions.add(match[1].toLowerCase());
  }
  return [...mentions];
}
export function parseTaskCommentInput(payload: {
  body?: unknown;
}): { body: string } | { error: string } {
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) {
    return { error: "Comment body is required." };
  }
  if (body.length > 2000) {
    return { error: "Comment body must be 2000 characters or fewer." };
  }
  return { body };
}

export type TaskListFilters = {
  status?: TaskStatus;
  priority?: TaskPriority;
  overdue?: boolean;
  assigneeEmployeeId?: string;
};

export function parseTaskListFilters(
  query: Record<string, unknown>,
): { filters: TaskListFilters } | { error: string } {
  const filters: TaskListFilters = {};
  if (query.status !== undefined) {
    const status = Object.values(TaskStatus).find((value) => value === query.status);
    if (!status) {
      return { error: "status must be todo, in_progress, blocked, or done." };
    }
    filters.status = status;
  }
  if (query.priority !== undefined) {
    const priority = Object.values(TaskPriority).find(
      (value) => value === query.priority,
    );
    if (!priority) {
      return { error: "priority must be low, medium, or high." };
    }
    filters.priority = priority;
  }
  if (query.overdue !== undefined) {
    if (query.overdue !== "true" && query.overdue !== "false") {
      return { error: "overdue must be true or false." };
    }
    filters.overdue = query.overdue === "true";
  }
  if (query.assigneeEmployeeId !== undefined) {
    if (
      typeof query.assigneeEmployeeId !== "string" ||
      !query.assigneeEmployeeId.trim()
    ) {
      return { error: "assigneeEmployeeId must be a non-empty string." };
    }
    filters.assigneeEmployeeId = query.assigneeEmployeeId.trim();
  }
  return { filters };
}

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
