import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { authContextMiddleware } from "./middleware/auth-context.js";
import { createGoogleAuthRouter } from "./auth/google-routes.js";
import { createPasswordlessAuthRouter } from "./auth/passwordless-routes.js";
import { createCompanyRouter } from "./companies/routes.js";
import { createPeopleRouter } from "./people/routes.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use("/api/v1/auth", createGoogleAuthRouter());
  app.use("/api/v1/auth", createPasswordlessAuthRouter());
  app.use(authContextMiddleware);
  app.use("/api/v1/companies", createCompanyRouter());
  app.use("/api/v1/people", createPeopleRouter());

  app.get("/api/v1/health", (_request, response) => {
    response.json({ status: "ok", service: "api" });
  });

  app.use(errorHandler);
  return app;
}
