import { Router } from "express";
import { getActorUserId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import {
  createCompanyOnboardingService,
  type CompanyCreationInput,
} from "./onboarding.js";

export function createCompanyRouter() {
  const router = Router();
  const onboarding = createCompanyOnboardingService(prisma);

  router.post("/", async (request, response) => {
    const ownerUserId = getActorUserId();
    if (!ownerUserId) {
      response.status(401).json({
        code: "authentication_required",
        message: "An authenticated identity is required to create a company.",
      });
      return;
    }

    try {
      const input: CompanyCreationInput = {
        ownerUserId,
        name: String(request.body?.name ?? ""),
        industry:
          typeof request.body?.industry === "string"
            ? request.body.industry
            : undefined,
        sizeBand:
          typeof request.body?.sizeBand === "string"
            ? request.body.sizeBand
            : undefined,
      };
      const company = await onboarding.create(input);
      response.status(201).json({
        companyId: company.companyId,
        membershipId: company.membershipId,
        employeeId: company.employeeId,
        plan: "trial",
        trialEndsAt: company.trialEndsAt.toISOString(),
      });
    } catch (error) {
      response.status(400).json({
        code: "company_creation_failed",
        message: error instanceof Error ? error.message : "Company creation failed.",
      });
    }
  });

  return router;
}
