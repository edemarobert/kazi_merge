import { MembershipRole, Prisma } from "@prisma/client";
import { Router } from "express";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { requirePolicy, type PolicyAction } from "../policy/policy.js";
import { getVisibleEmployee, listVisibleEmployees } from "./directory.js";
import { createInviteService, type InviteStore } from "./invites.js";

export function createPeopleRouter() {
  const router = Router();
  const invites = createInviteService(prisma, Date.now, (callback) =>
    prisma.$transaction((transaction) =>
      callback(transaction as unknown as InviteStore),
    ),
  );
  const employeeQuery = {
    findMany: async (args: unknown) =>
      (await prisma.employee.findMany(
        args as Prisma.EmployeeFindManyArgs,
      )) as unknown as Awaited<ReturnType<typeof listVisibleEmployees>>,
    findFirst: async (args: unknown) =>
      (await prisma.employee.findFirst(
        args as Prisma.EmployeeFindFirstArgs,
      )) as unknown as Awaited<ReturnType<typeof getVisibleEmployee>>,
  };

  router.get("/", async (request, response, next) => {
    try {
      const status =
        request.query.status === "active" || request.query.status === "inactive"
          ? request.query.status
          : undefined;
      const employees = await listVisibleEmployees(employeeQuery, {
        search:
          typeof request.query.search === "string"
            ? request.query.search.trim() || undefined
            : undefined,
        teamId:
          typeof request.query.teamId === "string" ? request.query.teamId : undefined,
        status,
      });
      response.json({ employees });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:employeeId", async (request, response, next) => {
    try {
      const employee = await getVisibleEmployee(
        employeeQuery,
        request.params.employeeId,
      );
      if (!employee) {
        response.status(404).json({
          code: "employee_not_found",
          message: "Employee not found.",
        });
        return;
      }
      response.json({ employee });
    } catch (error) {
      next(error);
    }
  });

  router.post("/invites", async (request, response, next) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) {
      response.status(401).json({
        code: "authentication_required",
        message: "An authenticated identity is required.",
      });
      return;
    }
    try {
      const role = request.body?.role as MembershipRole;
      const action: PolicyAction =
        role === MembershipRole.manager
          ? "people.invite.manager"
          : "people.invite.employee";
      await requirePolicy(action, { targetTeamId: request.body?.teamId });
      const result = await invites.create({
        companyId: requireCompanyId(),
        inviterUserId: actorUserId,
        email: typeof request.body?.email === "string" ? request.body.email : undefined,
        phoneE164:
          typeof request.body?.phoneE164 === "string"
            ? request.body.phoneE164
            : undefined,
        role,
      });
      response.status(201).json({
        inviteId: result.inviteId,
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/invites/accept", async (request, response) => {
    const userId = getActorUserId();
    if (!userId) {
      response.status(401).json({
        code: "authentication_required",
        message: "An authenticated identity is required.",
      });
      return;
    }
    try {
      const result = await invites.accept(String(request.body?.token ?? ""), userId);
      response.json(result);
    } catch (error) {
      response.status(400).json({
        code: "invite_acceptance_failed",
        message: error instanceof Error ? error.message : "Invite acceptance failed.",
      });
    }
  });
  return router;
}
