import assert from "node:assert/strict";
import { test } from "node:test";
import { MembershipRole } from "@prisma/client";
import {
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
