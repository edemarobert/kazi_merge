import assert from "node:assert/strict";
import { test } from "node:test";
import { TaskStatus } from "@prisma/client";
import {
  isOverdue,
  normalizeStatusChange,
  parseTaskCreationInput,
  parseTaskListFilters,
  validateStatusChange,
} from "../src/tasks/service.js";

test("task creation input applies safe defaults and trims text", () => {
  const result = parseTaskCreationInput({
    title: "  Prepare stock report  ",
    description: "  Include the weekend count ",
    assigneeEmployeeId: "employee-1",
    priority: "high",
    dueAt: "2026-11-05T09:00:00.000Z",
  });

  assert.ok("input" in result);
  if ("input" in result) {
    assert.deepEqual(result.input, {
      title: "Prepare stock report",
      description: "Include the weekend count",
      assigneeEmployeeId: "employee-1",
      teamId: null,
      priority: "high",
      dueAt: new Date("2026-11-05T09:00:00.000Z"),
    });
  }
});

test("task creation input rejects invalid assignment fields", () => {
  assert.deepEqual(
    parseTaskCreationInput({
      title: "A task",
      assigneeEmployeeId: "employee-1",
      priority: "urgent",
    }),
    { error: "priority must be low, medium, or high." },
  );
  assert.deepEqual(
    parseTaskCreationInput({
      title: "A task",
      assigneeEmployeeId: "employee-1",
      dueAt: "not-a-date",
    }),
    { error: "dueAt must be a valid ISO date." },
  );
});

test("task list filters validate status, priority, and overdue values", () => {
  assert.deepEqual(
    parseTaskListFilters({
      status: "blocked",
      priority: "high",
      overdue: "true",
      assigneeEmployeeId: " employee-1 ",
    }),
    {
      filters: {
        status: TaskStatus.blocked,
        priority: "high",
        overdue: true,
        assigneeEmployeeId: "employee-1",
      },
    },
  );
  assert.deepEqual(parseTaskListFilters({ status: "unknown" }), {
    error: "status must be todo, in_progress, blocked, or done.",
  });
  assert.deepEqual(parseTaskListFilters({ priority: "urgent" }), {
    error: "priority must be low, medium, or high.",
  });
  assert.deepEqual(parseTaskListFilters({ overdue: "yes" }), {
    error: "overdue must be true or false.",
  });
});

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
  assert.equal(
    validateStatusChange({
      status: TaskStatus.blocked,
      blockedReason: 42,
    }),
    "blockedReason must be text.",
  );
  assert.equal(
    validateStatusChange({
      status: TaskStatus.blocked,
      blockedReason: "x".repeat(501),
    }),
    "blockedReason must be 500 characters or fewer.",
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
  assert.deepEqual(
    normalizeStatusChange({
      status: TaskStatus.blocked,
      blockedReason: "  Waiting for stock  ",
    }),
    { status: TaskStatus.blocked, blockedReason: "Waiting for stock" },
  );
});

test("overdue excludes completed tasks", () => {
  const yesterday = new Date(Date.now() - 86400000);
  assert.equal(isOverdue(yesterday, TaskStatus.todo), true);
  assert.equal(isOverdue(yesterday, TaskStatus.done), false);
});
