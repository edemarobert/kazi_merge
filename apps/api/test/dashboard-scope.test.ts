import assert from "node:assert/strict";
import { test } from "node:test";
import { MembershipRole } from "@prisma/client";
import {
  calculateOnTimeCompletionRate,
  dashboardTaskAssigneeFilter,
  selectDashboardEmployeeIds,
} from "../src/dashboard/scope.js";

test("owners receive company-wide workload scope", () => {
  assert.equal(
    selectDashboardEmployeeIds(MembershipRole.owner, "owner", [
      { id: "owner", managerId: null, teamIds: [] },
      { id: "employee", managerId: null, teamIds: ["team-a"] },
    ]),
    null,
  );
});

test("managers receive team members and recursive reports only", () => {
  const ids = selectDashboardEmployeeIds(MembershipRole.manager, "manager", [
    { id: "manager", managerId: null, teamIds: ["team-a"] },
    { id: "team-member", managerId: null, teamIds: ["team-a"] },
    { id: "direct-report", managerId: "manager", teamIds: [] },
    { id: "nested-report", managerId: "direct-report", teamIds: [] },
    { id: "other", managerId: null, teamIds: ["team-b"] },
  ]);

  assert.deepEqual(
    new Set(ids),
    new Set(["manager", "team-member", "direct-report", "nested-report"]),
  );
});
test("dashboard task counts stay company-wide for owners", () => {
  assert.deepEqual(dashboardTaskAssigneeFilter(null), {});
});

test("dashboard task counts use the manager workload scope", () => {
  assert.deepEqual(dashboardTaskAssigneeFilter(["manager", "report"]), {
    assigneeEmployeeId: { in: ["manager", "report"] },
  });
});
test("on-time completion rate uses due-dated completions from the last 30 days", () => {
  const now = new Date("2026-11-30T12:00:00.000Z");
  assert.equal(
    calculateOnTimeCompletionRate(
      [
        {
          dueAt: new Date("2026-11-20T12:00:00.000Z"),
          completedAt: new Date("2026-11-19T12:00:00.000Z"),
        },
        {
          dueAt: new Date("2026-11-20T12:00:00.000Z"),
          completedAt: new Date("2026-11-21T12:00:00.000Z"),
        },
        { dueAt: null, completedAt: new Date("2026-11-22T12:00:00.000Z") },
        {
          dueAt: new Date("2026-10-01T12:00:00.000Z"),
          completedAt: new Date("2026-10-02T12:00:00.000Z"),
        },
      ],
      now,
    ),
    50,
  );
});

test("on-time completion rate is empty when no due-dated task qualifies", () => {
  assert.equal(
    calculateOnTimeCompletionRate(
      [{ dueAt: null, completedAt: new Date("2026-11-20T12:00:00.000Z") }],
      new Date("2026-11-30T12:00:00.000Z"),
    ),
    null,
  );
});
