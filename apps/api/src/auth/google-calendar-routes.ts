import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth-context.js";
import { sessionCookieName } from "./cookie.js";
import {
  createGoogleOAuthClient,
  createGoogleState,
  googleCalendarScope,
  readGoogleConfig,
  readGoogleState,
} from "./google.js";

type GoogleCalendarRouteOptions = {
  config?: ReturnType<typeof readGoogleConfig>;
  fetcher?: typeof fetch;
  onAuthorization?: (input: {
    userId: string;
    companyId: string;
    refreshToken?: string;
  }) => Promise<void>;
  onDisconnect?: (input: { userId: string; companyId: string }) => Promise<void>;
};

function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1);
}

export function createGoogleCalendarRouter(options: GoogleCalendarRouteOptions = {}) {
  const router = Router();
  const config = options.config ?? readGoogleConfig();

  router.get("/calendar", (request, response) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      response.status(401).json({
        code: "authentication_required",
        message: "A valid session is required for Calendar authorization.",
      });
      return;
    }
    if (!config || !config.calendarRedirectUri) {
      response.status(503).json({
        code: "google_calendar_disabled",
        message: "Google Calendar authorization is not configured.",
      });
      return;
    }

    const state = createGoogleState(config.stateSecret, Date.now(), "calendar");
    response.setHeader(
      "Set-Cookie",
      sessionCookieName +
        "_calendar_oauth_state=" +
        state +
        "; HttpOnly; SameSite=Lax; Max-Age=600" +
        (process.env.NODE_ENV === "production" ? "; Secure" : ""),
    );
    const client = createGoogleOAuthClient(
      { ...config, redirectUri: config.calendarRedirectUri },
      options.fetcher,
    );
    response.redirect(
      client.authorizationUrl(state, [googleCalendarScope], "consent", true),
    );
  });

  router.get("/calendar/callback", async (request, response) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      response.status(401).json({
        code: "authentication_required",
        message: "A valid session is required for Calendar authorization.",
      });
      return;
    }
    if (!config || !config.calendarRedirectUri) {
      response.status(503).json({
        code: "google_calendar_disabled",
        message: "Google Calendar authorization is not configured.",
      });
      return;
    }

    const state = typeof request.query.state === "string" ? request.query.state : "";
    const stateCookie = readCookie(
      request.header("cookie") ?? "",
      sessionCookieName + "_calendar_oauth_state",
    );
    const parsedState = readGoogleState(state, config.stateSecret);
    if (!stateCookie || stateCookie !== state || parsedState?.purpose !== "calendar") {
      response.status(400).json({
        code: "invalid_calendar_oauth_state",
        message: "The Google Calendar authorization state is invalid or expired.",
      });
      return;
    }

    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (!code) {
      response.status(400).json({
        code: "google_calendar_authorization_failed",
        message: "Google did not return a Calendar authorization code.",
      });
      return;
    }

    try {
      const client = createGoogleOAuthClient(
        { ...config, redirectUri: config.calendarRedirectUri },
        options.fetcher,
      );
      const token = await client.exchangeCalendarCode(code);
      if (!options.onAuthorization) {
        response.status(501).json({
          code: "calendar_authorization_unavailable",
          message: "Google Calendar authorization is not configured.",
        });
        return;
      }
      await options.onAuthorization({
        userId: auth.userId,
        companyId: auth.companyId,
        refreshToken: token.refreshToken,
      });
      response.json({ calendar: "connected" });
    } catch (error) {
      response.status(502).json({
        code: "google_calendar_authorization_failed",
        message:
          error instanceof Error
            ? error.message
            : "Google Calendar authorization failed.",
      });
    }
  });

  router.delete("/calendar", async (request, response) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      response.status(401).json({
        code: "authentication_required",
        message: "A valid session is required to disconnect Calendar.",
      });
      return;
    }
    if (!options.onDisconnect) {
      response.status(503).json({
        code: "google_calendar_disabled",
        message: "Google Calendar disconnect is not configured.",
      });
      return;
    }

    try {
      await options.onDisconnect({
        userId: auth.userId,
        companyId: auth.companyId,
      });
      response.json({ calendar: "disconnected" });
    } catch (error) {
      response.status(502).json({
        code: "google_calendar_disconnect_failed",
        message:
          error instanceof Error ? error.message : "Google Calendar disconnect failed.",
      });
    }
  });
  return router;
}
