import { TaskStatus } from "@prisma/client";

export type TaskStatusChange = {
  status: TaskStatus;
  blockedReason?: string | null;
};

export function validateStatusChange({
  status,
  blockedReason,
}: TaskStatusChange): string | null {
  if (status === TaskStatus.blocked && !blockedReason?.trim()) {
    return "A blocked task must include a reason.";
  }
  return null;
}

export function normalizeStatusChange({
  status,
  blockedReason,
}: TaskStatusChange): { status: TaskStatus; blockedReason: string | null } {
  const error = validateStatusChange({ status, blockedReason });
  if (error) {
    throw new Error(error);
  }
  return {
    status,
    blockedReason: status === TaskStatus.blocked ? blockedReason!.trim() : null,
  };
}

export function isOverdue(
  dueAt: Date | null,
  status: TaskStatus,
  now = new Date(),
): boolean {
  return Boolean(dueAt && dueAt < now && status !== TaskStatus.done);
}
