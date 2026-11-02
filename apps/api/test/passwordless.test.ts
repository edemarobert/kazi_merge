import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmailLinkService } from "../src/auth/email-link.js";
import { createOtpService } from "../src/auth/phone-otp.js";

test("phone OTPs expire, allow five attempts, and are single use", async () => {
  let now = 1_000;
  const sent: string[] = [];
  const service = createOtpService(
    {
      async send(_phone, code) {
        sent.push(code);
      },
    },
    () => now,
  );

  await service.request("+256700000000");
  assert.equal(sent.length, 1);
  assert.equal(service.verify("+256700000000", "000000"), false);
  assert.equal(service.verify("+256700000000", "000000"), false);
  assert.equal(service.verify("+256700000000", "000000"), false);
  assert.equal(service.verify("+256700000000", "000000"), false);
  assert.equal(service.verify("+256700000000", sent[0]), true);
  assert.equal(service.verify("+256700000000", sent[0]), false);

  await service
    .request("+256700000000")
    .catch((error: Error) => assert.match(error.message, /recently requested/));
  now += 5 * 60 * 1000 + 1;
  assert.equal(service.verify("+256700000000", "000000"), false);
});

test("email links are opaque, expiring, and single use", async () => {
  let now = 1_000;
  let sentLink = "";
  const service = createEmailLinkService(
    {
      async send(_email, link) {
        sentLink = link;
      },
    },
    "https://kazi.example/auth/email/verify",
    () => now,
  );

  await service.request("Owner@Example.com");
  const token = new URL(sentLink).searchParams.get("token");
  assert.ok(token);
  assert.equal(service.consume("owner@example.com", "wrong"), false);
  assert.equal(service.consume("owner@example.com", token), true);
  assert.equal(service.consume("owner@example.com", token), false);

  await service.request("owner@example.com");
  now += 15 * 60 * 1000 + 1;
  const expiredToken = new URL(sentLink).searchParams.get("token");
  assert.ok(expiredToken);
  assert.equal(service.consume("owner@example.com", expiredToken), false);
});
