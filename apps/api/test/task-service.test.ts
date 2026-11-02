import assert from "node:assert/strict";
import { test } from "node:test";
import { TaskStatus } from "@prisma/client";
import {
  isOverdue,
  normalizeStatusChange,
  validateStatusChange,
} from "../src/tasks/service.js";

test("blocked status requires a non-empty reason", () => {
  assert.equal(
    validateStatusChange({ status: TaskStatus.blocked, blockedReason: " " }),
    "A blocked task must include a reason.",
  );
  assert.equal(
    validateStatusChange({
      status: TaskStatus.blocked,
      blockedReason: "Waiting for stock",
    }),
    null,
  );
});

test("status normalization clears blocked reasons after unblocking", () => {
  assert.deepEqual(
    normalizeStatusChange({
      status: TaskStatus.in_progress,
      blockedReason: "old reason",
    }),
    { status: TaskStatus.in_progress, blockedReason: null },
  );
});

test("overdue excludes completed tasks", () => {
  const yesterday = new Date(Date.now() - 86400000);
  assert.equal(isOverdue(yesterday, TaskStatus.todo), true);
  assert.equal(isOverdue(yesterday, TaskStatus.done), false);
});
