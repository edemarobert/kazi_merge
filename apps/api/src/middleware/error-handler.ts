import type { ErrorRequestHandler } from "express";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { PolicyDeniedError } from "../policy/policy.js";

export const errorHandler: ErrorRequestHandler = async (
  error,
  _request,
  response,
  next,
) => {
  if (!(error instanceof PolicyDeniedError)) {
    next(error);
    return;
  }

  const companyId = requireCompanyId();
  const actorUserId = getActorUserId();
  if (actorUserId) {
    await prisma.activityLog.create({
      data: {
        companyId,
        actorUserId,
        action: "authorization.denied",
        entityType: "policy",
        entityId: actorUserId,
        metadata: { policyAction: error.action },
      },
    });
  }
  response.status(403).json({
    code: "forbidden",
    message: error.message,
    details: { action: error.action },
  });
};
