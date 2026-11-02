import { MembershipRole, Prisma } from "@prisma/client";
import { Router } from "express";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { requirePolicy, type PolicyAction } from "../policy/policy.js";
import { getVisibleEmployee, listVisibleEmployees } from "./directory.js";
import { createInviteService, type InviteStore } from "./invites.js";
import { changeManager, listOrganization } from "./organization.js";
import { importEmployeeRows, previewEmployeeCsv } from "./csv-import.js";

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
  const organizationStore = {
    department: {
      findMany: async (args: unknown) =>
        (await prisma.department.findMany(
          args as Prisma.DepartmentFindManyArgs,
        )) as unknown as Awaited<ReturnType<typeof listOrganization>>,
    },
    employee: {
      findFirst: async (args: unknown) =>
        (await prisma.employee.findFirst(
          args as Prisma.EmployeeFindFirstArgs,
        )) as unknown as { id: string } | null,
      update: async (args: unknown) =>
        (await prisma.employee.update(
          args as Prisma.EmployeeUpdateArgs,
        )) as unknown as { id: string; managerId: string | null },
    },
  };

  router.get("/organization", async (_request, response, next) => {
    try {
      await requirePolicy("people.organization.view");
      response.json({ departments: await listOrganization(organizationStore) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/import/preview", async (request, response) => {
    await requirePolicy("people.import");
    const csv = typeof request.body?.csv === "string" ? request.body.csv : "";
    response.json(previewEmployeeCsv(csv));
  });

  router.post("/import", async (request, response, next) => {
    try {
      await requirePolicy("people.import");
      const csv = typeof request.body?.csv === "string" ? request.body.csv : "";
      const preview = previewEmployeeCsv(csv);
      if (preview.errors.length > 0 && preview.rows.length === 0) {
        response.status(400).json(preview);
        return;
      }
      const result = await prisma.$transaction(async (transaction) =>
        importEmployeeRows(
          transaction as unknown as Parameters<typeof importEmployeeRows>[0],
          requireCompanyId(),
          preview.rows,
        ),
      );
      response.status(201).json({ ...result, previewErrors: preview.errors });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:employeeId/manager", async (request, response, next) => {
    try {
      await requirePolicy("people.manager.change", {
        targetEmployeeId: request.params.employeeId,
      });
      const managerId =
        request.body?.managerId === null
          ? null
          : typeof request.body?.managerId === "string"
            ? request.body.managerId
            : undefined;
      if (managerId === undefined) {
        response.status(400).json({
          code: "invalid_manager",
          message: "managerId must be a string or null.",
        });
        return;
      }
      response.json({
        employee: await changeManager(
          organizationStore,
          request.params.employeeId,
          managerId,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

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
