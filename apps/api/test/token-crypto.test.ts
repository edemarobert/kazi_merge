import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from "../src/auth/token-crypto.js";

test("integration tokens encrypt and decrypt with authenticated encryption", () => {
  const previous = process.env.INTEGRATION_TOKEN_KEY;
  process.env.INTEGRATION_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptIntegrationToken("google-refresh-token");
    assert.notEqual(encrypted, "google-refresh-token");
    assert.equal(decryptIntegrationToken(encrypted), "google-refresh-token");
    assert.throws(() =>
      decryptIntegrationToken(
        `${encrypted.slice(0, -1)}${encrypted.endsWith("a") ? "b" : "a"}`,
      ),
    );
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_TOKEN_KEY;
    else process.env.INTEGRATION_TOKEN_KEY = previous;
  }
});
