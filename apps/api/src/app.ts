import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { tenantContextMiddleware } from "./middleware/tenant-context.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(tenantContextMiddleware);

  app.get("/api/v1/health", (_request, response) => {
    response.json({ status: "ok", service: "api" });
  });

  app.use(errorHandler);
  return app;
}
