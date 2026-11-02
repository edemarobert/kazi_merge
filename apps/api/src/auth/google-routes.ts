import { Router } from "express";
import { sessionCookieName } from "./cookie.js";
import {
  createGoogleOAuthClient,
  createGoogleState,
  readGoogleConfig,
  verifyGoogleState,
  type GoogleIdentity,
} from "./google.js";

type GoogleRouteOptions = {
  config?: ReturnType<typeof readGoogleConfig>;
  onIdentity?: (identity: GoogleIdentity) => Promise<{ userId: string }>;
  fetcher?: typeof fetch;
};

export function createGoogleAuthRouter(options: GoogleRouteOptions = {}) {
  const router = Router();
  const config = options.config ?? readGoogleConfig();

  router.get("/google", (_request, response) => {
    if (!config) {
      response.status(503).json({
        code: "google_sign_in_disabled",
        message: "Google sign-in is not configured.",
      });
      return;
    }

    const state = createGoogleState(config.stateSecret);
    response.setHeader(
      "Set-Cookie",
      `${sessionCookieName}_oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
    response.redirect(createGoogleOAuthClient(config).authorizationUrl(state));
  });

  router.get("/google/callback", async (request, response) => {
    if (!config) {
      response.status(503).json({
        code: "google_sign_in_disabled",
        message: "Google sign-in is not configured.",
      });
      return;
    }
    const state = typeof request.query.state === "string" ? request.query.state : "";
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const cookieHeader = request.header("cookie") ?? "";
    const stateCookie = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookieName}_oauth_state=`))
      ?.slice(`${sessionCookieName}_oauth_state=`.length);
    if (
      !stateCookie ||
      stateCookie !== state ||
      !verifyGoogleState(state, config.stateSecret)
    ) {
      response.status(400).json({
        code: "invalid_oauth_state",
        message: "The Google sign-in state is invalid or expired.",
      });
      return;
    }
    if (!code) {
      response.status(400).json({
        code: "google_authorization_failed",
        message: "Google did not return an authorization code.",
      });
      return;
    }

    try {
      const identity = await createGoogleOAuthClient(
        config,
        options.fetcher,
      ).exchangeCode(code);
      if (!options.onIdentity) {
        response.status(501).json({
          code: "identity_completion_unavailable",
          message: "Google identity completion is not configured.",
        });
        return;
      }
      const result = await options.onIdentity(identity);
      response.json({ userId: result.userId });
    } catch (error) {
      response.status(502).json({
        code: "google_sign_in_failed",
        message: error instanceof Error ? error.message : "Google sign-in failed.",
      });
    }
  });
  return router;
}
