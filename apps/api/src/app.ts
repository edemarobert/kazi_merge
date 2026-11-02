import express from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";
import { errorHandler } from "./middleware/error-handler.js";
import { authContextMiddleware } from "./middleware/auth-context.js";
import { createGoogleAuthRouter } from "./auth/google-routes.js";
import { createPasswordlessAuthRouter } from "./auth/passwordless-routes.js";
import { completeGoogleIdentity, completePasswordlessIdentity } from "./auth/index.js";
import { createCompanyRouter } from "./companies/routes.js";
import { createPeopleRouter } from "./people/routes.js";
import { createDashboardRouter } from "./dashboard/routes.js";
import { createTasksRouter } from "./tasks/routes.js";

export function createApp() {
  const app = express();
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const csrf = doubleCsrf({
    getSecret: () =>
      process.env.CSRF_SECRET ??
      process.env.SESSION_SECRET ??
      "development-only-csrf-secret",
    getSessionIdentifier: (request) =>
      request.header("x-forwarded-for") ?? request.ip ?? "unknown-client",
    cookieName: "kazi_csrf",
    cookieOptions: {
      sameSite: "lax",
      secure: true,
      httpOnly: false,
      path: "/",
    },
  });

  app.use(express.json());
  app.use(cookieParser());
  app.get("/api/v1/auth/csrf-token", (request, response) => {
    response.json({ token: csrf.generateCsrfToken(request, response) });
  });
  app.use("/api/v1/auth", authRateLimit, csrf.doubleCsrfProtection);
  app.use(
    "/api/v1/auth",
    createGoogleAuthRouter({ onIdentity: completeGoogleIdentity }),
  );
  app.use(
    "/api/v1/auth",
    createPasswordlessAuthRouter({
      onVerified: completePasswordlessIdentity,
    }),
  );
  app.use(authContextMiddleware);
  app.use("/api/v1/companies", createCompanyRouter());
  app.use("/api/v1/people", createPeopleRouter());
  app.use("/api/v1/dashboard", createDashboardRouter());
  app.use("/api/v1/tasks", createTasksRouter());

  app.get("/api/v1/health", (_request, response) => {
    response.json({ status: "ok", service: "api" });
  });

  app.use(errorHandler);
  return app;
}
