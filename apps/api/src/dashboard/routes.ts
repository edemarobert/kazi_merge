import { Router } from "express";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import {
  calculateOnTimeCompletionRate,
  dashboardTaskAssigneeFilter,
  selectDashboardEmployeeIds,
} from "./scope.js";
import { prisma } from "../db/prisma.js";
import { requirePolicy } from "../policy/policy.js";

export function createDashboardRouter() {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      await requirePolicy("dashboard.view");
      const companyId = requireCompanyId();
      const actorUserId = getActorUserId();
      if (!actorUserId) {
        throw new Error("Actor context is required for dashboard access.");
      }
      const membership = await prisma.membership.findUnique({
        where: { companyId_userId: { companyId, userId: actorUserId } },
        select: { role: true, employee: { select: { id: true } } },
      });
      if (!membership?.employee) {
        throw new Error("An employee record is required for dashboard access.");
      }
      const scopeEmployees = await prisma.employee.findMany({
        where: { status: "active", deletedAt: null },
        select: {
          id: true,
          managerId: true,
          teamMembers: { select: { teamId: true } },
        },
      });
      const scopedEmployeeIds = selectDashboardEmployeeIds(
        membership.role,
        membership.employee.id,
        scopeEmployees.map((employee) => ({
          id: employee.id,
          managerId: employee.managerId,
          teamIds: employee.teamMembers.map((teamMember) => teamMember.teamId),
        })),
      );
      const taskAssigneeFilter = dashboardTaskAssigneeFilter(scopedEmployeeIds);
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + (7 - now.getDay()));
      const [
        company,
        openTasks,
        overdue,
        dueThisWeek,
        blocked,
        recentCompletedTasks,
        workload,
        activity,
      ] = await Promise.all([
        prisma.company.findFirst({
          where: { id: companyId },
          select: { name: true, trialEndsAt: true },
        }),
        prisma.task.count({
          where: {
            ...taskAssigneeFilter,
            deletedAt: null,
            status: { not: "done" },
          },
        }),
        prisma.task.count({
          where: {
            ...taskAssigneeFilter,
            deletedAt: null,
            status: { not: "done" },
            dueAt: { lt: now },
          },
        }),
        prisma.task.count({
          where: {
            ...taskAssigneeFilter,
            deletedAt: null,
            status: { not: "done" },
            dueAt: { gte: now, lte: weekEnd },
          },
        }),
        prisma.task.count({
          where: {
            ...taskAssigneeFilter,
            deletedAt: null,
            status: "blocked",
          },
        }),
        prisma.task.findMany({
          where: {
            ...taskAssigneeFilter,
            deletedAt: null,
            status: "done",
            dueAt: { not: null },
            completedAt: { gte: new Date(now.getTime() - 30 * 86400000), lte: now },
          },
          select: { dueAt: true, completedAt: true },
        }),
        prisma.employee.findMany({
          where: {
            status: "active",
            deletedAt: null,
            ...(scopedEmployeeIds ? { id: { in: scopedEmployeeIds } } : {}),
          },
          select: {
            id: true,
            membership: { select: { user: { select: { name: true } } } },
            assignedTasks: {
              where: {
                ...taskAssigneeFilter,
                deletedAt: null,
                status: { not: "done" },
              },
              select: { dueAt: true },
            },
          },
        }),
        prisma.activityLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, action: true, createdAt: true },
        }),
      ]);
      const onTimeCompletionRate = calculateOnTimeCompletionRate(
        recentCompletedTasks,
        now,
      );
      const trialDays = company?.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((company.trialEndsAt.getTime() - now.getTime()) / 86400000),
          )
        : null;
      response.json({
        companyName: company?.name ?? null,
        trialDays,
        metrics: { openTasks, overdue, dueThisWeek, blocked, onTimeCompletionRate },
        workload: workload.map((employee) => ({
          id: employee.id,
          name: employee.membership.user.name,
          open: employee.assignedTasks.length,
          overdue: employee.assignedTasks.filter(
            (task) => task.dueAt && task.dueAt < now,
          ).length,
        })),
        activity,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
