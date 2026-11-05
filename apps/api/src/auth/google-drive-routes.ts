import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth-context.js";
import { sessionCookieName } from "./cookie.js";
import {
  createGoogleOAuthClient,
  createGoogleState,
  googleDriveScope,
  readGoogleConfig,
  readGoogleState,
} from "./google.js";

type GoogleDriveRouteOptions = {
  config?: ReturnType<typeof readGoogleConfig>;
  fetcher?: typeof fetch;
  onAuthorization?: (input: {
    userId: string;
    companyId: string;
    refreshToken?: string;
  }) => Promise<void>;
  onAccessToken?: (input: { userId: string; companyId: string }) => Promise<string>;
};

function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1);
}

export function createGoogleDriveRouter(options: GoogleDriveRouteOptions = {}) {
  const router = Router();
  const config = options.config ?? readGoogleConfig();

  router.get("/drive", (request, response) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      response.status(401).json({
        code: "authentication_required",
        message: "A valid session is required for Drive authorization.",
      });
      return;
    }
    if (!config?.driveRedirectUri) {
      response.status(503).json({
        code: "google_drive_disabled",
        message: "Google Drive authorization is not configured.",
      });
      return;
    }

    const state = createGoogleState(config.stateSecret, Date.now(), "drive");
    response.setHeader(
      "Set-Cookie",
      sessionCookieName +
        "_drive_oauth_state=" +
        state +
        "; HttpOnly; SameSite=Lax; Max-Age=600" +
        (process.env.NODE_ENV === "production" ? "; Secure" : ""),
    );
    const client = createGoogleOAuthClient(
      { ...config, redirectUri: config.driveRedirectUri },
      options.fetcher,
    );
    response.redirect(
      client.authorizationUrl(state, [googleDriveScope], "consent", true),
    );
  });

  router.get("/drive/callback", async (request, response) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      response.status(401).json({
        code: "authentication_required",
        message: "A valid session is required for Drive authorization.",
      });
      return;
    }
    if (!config?.driveRedirectUri) {
      response.status(503).json({
        code: "google_drive_disabled",
        message: "Google Drive authorization is not configured.",
      });
      return;
    }

    const state = typeof request.query.state === "string" ? request.query.state : "";
    const stateCookie = readCookie(
      request.header("cookie") ?? "",
      sessionCookieName + "_drive_oauth_state",
    );
    const parsedState = readGoogleState(state, config.stateSecret);
    if (!stateCookie || stateCookie !== state || parsedState?.purpose !== "drive") {
      response.status(400).json({
        code: "invalid_drive_oauth_state",
        message: "The Google Drive authorization state is invalid or expired.",
      });
      return;
    }

    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (!code) {
      response.status(400).json({
        code: "google_drive_authorization_failed",
        message: "Google did not return a Drive authorization code.",
      });
      return;
    }

    try {
      const client = createGoogleOAuthClient(
        { ...config, redirectUri: config.driveRedirectUri },
        options.fetcher,
      );
      const token = await client.exchangeDriveCode(code);
      if (!options.onAuthorization) {
        response.status(501).json({
          code: "drive_authorization_unavailable",
          message: "Google Drive authorization is not configured.",
        });
        return;
      }
      await options.onAuthorization({
        userId: auth.userId,
        companyId: auth.companyId,
        refreshToken: token.refreshToken,
      });
      response.json({ drive: "connected" });
    } catch (error) {
      response.status(502).json({
        code: "google_drive_authorization_failed",
        message:
          error instanceof Error ? error.message : "Google Drive authorization failed.",
      });
    }
  });

  router.get("/drive/token", async (request, response) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      response.status(401).json({
        code: "authentication_required",
        message: "A valid session is required for Drive Picker access.",
      });
      return;
    }
    if (!config?.pickerApiKey || !options.onAccessToken) {
      response.status(503).json({
        code: "google_drive_picker_disabled",
        message: "Google Drive Picker is not configured.",
      });
      return;
    }

    try {
      const accessToken = await options.onAccessToken({
        userId: auth.userId,
        companyId: auth.companyId,
      });
      response.json({
        accessToken,
        developerKey: config.pickerApiKey,
      });
    } catch (error) {
      response.status(502).json({
        code: "google_drive_picker_token_failed",
        message:
          error instanceof Error
            ? error.message
            : "Google Drive Picker access could not be created.",
      });
    }
  });

  return router;
}
