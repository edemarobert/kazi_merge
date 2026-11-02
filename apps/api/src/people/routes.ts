import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { requirePolicy, type PolicyAction } from "../policy/policy.js";
import { createInviteService, type InviteStore } from "./invites.js";

export function createPeopleRouter() {
  const router = Router();
  const invites = createInviteService(prisma, Date.now, (callback) =>
    prisma.$transaction((transaction) =>
      callback(transaction as unknown as InviteStore),
    ),
  );

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
