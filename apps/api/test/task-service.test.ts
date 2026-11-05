import assert from "node:assert/strict";
import { test } from "node:test";
import { TaskStatus } from "@prisma/client";
import { parseDriveLinkInput } from "../src/tasks/drive-links.js";
import {
  isOverdue,
  normalizeStatusChange,
  parseMentionTokens,
  parseTaskCommentInput,
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

test("Drive links accept HTTPS Drive hosts and reject arbitrary URLs", () => {
  assert.deepEqual(
    parseDriveLinkInput({
      name: "  Brief  ",
      url: "https://drive.google.com/file/d/abc/view",
      driveFileId: "abc",
    }),
    {
      input: {
        name: "Brief",
        url: "https://drive.google.com/file/d/abc/view",
        driveFileId: "abc",
      },
    },
  );
  assert.deepEqual(
    parseDriveLinkInput({ name: "Brief", url: "https://example.com/file" }),
    {
      error: "url must be a valid HTTPS Google Drive link.",
    },
  );
});
test("mention tokens are normalized and deduplicated", () => {
  assert.deepEqual(parseMentionTokens("@Alice please check @alice and @bob_2"), [
    "alice",
    "bob_2",
  ]);
});
test("comment input trims text and rejects empty or oversized comments", () => {
  assert.deepEqual(parseTaskCommentInput({ body: "  Stock received  " }), {
    body: "Stock received",
  });
  assert.deepEqual(parseTaskCommentInput({ body: "   " }), {
    error: "Comment body is required.",
  });
  assert.deepEqual(parseTaskCommentInput({ body: "x".repeat(2001) }), {
    error: "Comment body must be 2000 characters or fewer.",
  });
  assert.deepEqual(parseTaskCommentInput({ body: 42 }), {
    error: "Comment body is required.",
  });
});
test("overdue excludes completed tasks", () => {
  const yesterday = new Date(Date.now() - 86400000);
  assert.equal(isOverdue(yesterday, TaskStatus.todo), true);
  assert.equal(isOverdue(yesterday, TaskStatus.done), false);
});
