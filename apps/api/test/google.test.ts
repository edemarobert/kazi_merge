import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGoogleOAuthClient,
  createGoogleState,
  googleScopesText,
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
