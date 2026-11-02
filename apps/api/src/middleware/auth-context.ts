import type { NextFunction, Request, Response } from "express";
import { companyId, runWithCompanyContextAsync } from "../context/company-context.js";
import { readSessionCookie } from "../auth/cookie.js";
import { sessionService } from "../auth/index.js";

export type AuthenticatedRequest = Request & {
  auth?: {
    sessionId: string;
    userId: string;
    companyId: string;
  };
};

export async function authContextMiddleware(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> {
  if (request.path === "/api/v1/health") {
    next();
    return;
  }

  const token = readSessionCookie(request.header("cookie"));
  if (token) {
    const session = await sessionService.resolve(token);
    if (!session) {
      response.status(401).json({
        code: "invalid_session",
        message: "The session is invalid or has expired.",
      });
      return;
    }

    request.auth = {
      sessionId: session.id,
      userId: session.userId,
      companyId: session.companyId,
    };
    await runWithCompanyContextAsync(
      companyId(session.companyId),
      () => Promise.resolve(next()),
      session.userId,
    );
    return;
  }

  const tenantCompanyId = request.header("x-company-id");
  const testActorUserId = request.header("x-user-id");
  if (!tenantCompanyId || !testActorUserId) {
    response.status(401).json({
      code: "authentication_required",
      message: "A valid session is required for business requests.",
    });
    return;
  }

  if (process.env.NODE_ENV !== "test") {
    response.status(401).json({
      code: "session_required",
      message: "Testing tenant headers are available only in test mode.",
    });
    return;
  }

  request.auth = {
    sessionId: "test-session",
    userId: testActorUserId,
    companyId: tenantCompanyId,
  };
  await runWithCompanyContextAsync(
    companyId(tenantCompanyId),
    () => Promise.resolve(next()),
    testActorUserId,
  );
}
