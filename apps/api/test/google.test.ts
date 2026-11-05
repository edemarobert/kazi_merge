import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGoogleOAuthClient,
  createGoogleState,
  googleCalendarScope,
  googleDriveScope,
  googleScopesText,
  readGoogleState,
  revokeGoogleToken,
  verifyGoogleState,
} from "../src/auth/google.js";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:4000/api/v1/auth/google/callback",
  stateSecret: "test-state-secret",
};

test("Google sign-in requests only OpenID identity scopes", () => {
  const state = createGoogleState(config.stateSecret);
  const url = new URL(createGoogleOAuthClient(config).authorizationUrl(state));

  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
});

test("Google OAuth state is signed, expires, and rejects tampering", () => {
  const state = createGoogleState(config.stateSecret, 1_000);

  assert.equal(verifyGoogleState(state, config.stateSecret, 1_001), true);
  assert.equal(verifyGoogleState(state, config.stateSecret, 601_001), false);
  assert.equal(verifyGoogleState(`${state}tampered`, config.stateSecret, 1_001), false);
  assert.equal(googleScopesText, "openid email profile");
});

test("Google identity exchange validates the audience and email verification", async () => {
  const responses = [
    { ok: true, json: async () => ({ id_token: "id-token" }) },
    {
      ok: true,
      json: async () => ({
        sub: "google-sub",
        email: "owner@example.com",
        email_verified: "true",
        name: "Owner",
        aud: config.clientId,
      }),
    },
  ];
  const identity = await createGoogleOAuthClient(config, async () => {
    const response = responses.shift();
    assert.ok(response);
    return response as Response;
  }).exchangeCode("authorization-code");

  assert.deepEqual(identity, {
    subject: "google-sub",
    email: "owner@example.com",
    name: "Owner",
    avatarUrl: undefined,
  });
});

test("Calendar authorization is incremental and requests only the Calendar scope", () => {
  const state = createGoogleState(config.stateSecret, 1_000, "calendar");
  const url = new URL(
    createGoogleOAuthClient({
      ...config,
      calendarRedirectUri:
        "http://localhost:4000/api/v1/integrations/google/calendar/callback",
    }).authorizationUrl(state, [googleCalendarScope], "consent", true),
  );

  assert.equal(url.searchParams.get("scope"), googleCalendarScope);
  assert.equal(url.searchParams.get("include_granted_scopes"), "true");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(readGoogleState(state, config.stateSecret, 1_001)?.purpose, "calendar");
  assert.equal(readGoogleState(state, config.stateSecret, 601_001), null);
});

test("Calendar token exchange does not require a second identity token", async () => {
  const client = createGoogleOAuthClient(
    config,
    async () =>
      ({
        ok: true,
        json: async () => ({ refresh_token: "calendar-refresh-token" }),
      }) as Response,
  );

  assert.deepEqual(await client.exchangeCalendarCode("calendar-code"), {
    refreshToken: "calendar-refresh-token",
  });
});

test("Google disconnect revokes the stored token", async () => {
  let request: RequestInit | undefined;
  await revokeGoogleToken("refresh-token", async (_url, init) => {
    request = init;
    return { ok: true } as Response;
  });

  assert.equal(request?.method, "POST");
  assert.equal((request?.body as URLSearchParams).get("token"), "refresh-token");
});

test("Drive authorization requests only the narrow drive.file scope", () => {
  const state = createGoogleState(config.stateSecret, 1_000, "drive");
  const url = new URL(
    createGoogleOAuthClient({
      ...config,
      driveRedirectUri:
        "http://localhost:4000/api/v1/integrations/google/drive/callback",
    }).authorizationUrl(state, [googleDriveScope], "consent", true),
  );

  assert.equal(url.searchParams.get("scope"), googleDriveScope);
  assert.equal(url.searchParams.get("include_granted_scopes"), "true");
  assert.equal(readGoogleState(state, config.stateSecret, 1_001)?.purpose, "drive");
});

test("Drive access token refresh returns only a short-lived access token", async () => {
  const client = createGoogleOAuthClient(
    config,
    async () =>
      ({
        ok: true,
        json: async () => ({ access_token: "drive-access-token" }),
      }) as Response,
  );

  assert.equal(
    await client.refreshAccessToken("drive-refresh-token"),
    "drive-access-token",
  );
});
