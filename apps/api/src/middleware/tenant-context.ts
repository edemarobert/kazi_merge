import type { NextFunction, Request, Response } from "express";
import { companyId, runWithCompanyContext } from "../context/company-context.js";

type TenantRequest = Request & {
  tenantCompanyId?: string;
  actorUserId?: string;
};

export function tenantContextMiddleware(
  request: TenantRequest,
  response: Response,
  next: NextFunction,
): void {
  if (request.path === "/api/v1/health") {
    next();
    return;
  }

  const tenantCompanyId = request.header("x-company-id");
  if (!tenantCompanyId) {
    response.status(400).json({
      code: "company_context_required",
      message: "x-company-id is required for business requests.",
    });
    return;
  }

  request.tenantCompanyId = tenantCompanyId;
  request.actorUserId = request.header("x-user-id") ?? undefined;

  try {
    runWithCompanyContext(
      companyId(tenantCompanyId),
      () => next(),
      request.actorUserId,
    );
  } catch {
    response.status(400).json({
      code: "invalid_company_context",
      message: "x-company-id must not be empty.",
    });
  }
}
