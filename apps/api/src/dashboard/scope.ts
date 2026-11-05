import { MembershipRole } from "@prisma/client";

export type DashboardEmployee = {
  id: string;
  managerId: string | null;
  teamIds: string[];
};

export function selectDashboardEmployeeIds(
  role: MembershipRole,
  actorEmployeeId: string,
  employees: DashboardEmployee[],
): string[] | null {
  if (role === MembershipRole.owner) {
    return null;
  }

  const actor = employees.find((employee) => employee.id === actorEmployeeId);
  if (!actor) {
    return [];
  }

  const teamIds = new Set(actor.teamIds);
  const scopedIds = new Set<string>([actorEmployeeId]);
  for (const employee of employees) {
    if (employee.teamIds.some((teamId) => teamIds.has(teamId))) {
      scopedIds.add(employee.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const employee of employees) {
      if (
        employee.managerId &&
        scopedIds.has(employee.managerId) &&
        !scopedIds.has(employee.id)
      ) {
        scopedIds.add(employee.id);
        changed = true;
      }
    }
  }

  return [...scopedIds];
}
export function dashboardTaskAssigneeFilter(scopedEmployeeIds: string[] | null): {
  assigneeEmployeeId?: { in: string[] };
} {
  return scopedEmployeeIds ? { assigneeEmployeeId: { in: scopedEmployeeIds } } : {};
}
export type CompletedDashboardTask = {
  dueAt: Date | null;
  completedAt: Date | null;
};

export function calculateOnTimeCompletionRate(
  tasks: CompletedDashboardTask[],
  now: Date,
): number | null {
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const completedWithDueDates = tasks.filter(
    (task) =>
      task.dueAt !== null &&
      task.completedAt !== null &&
      task.completedAt >= thirtyDaysAgo &&
      task.completedAt <= now,
  );

  if (completedWithDueDates.length === 0) {
    return null;
  }

  const onTime = completedWithDueDates.filter(
    (task) => task.completedAt! <= task.dueAt!,
  ).length;
  return Math.round((onTime / completedWithDueDates.length) * 100);
}
