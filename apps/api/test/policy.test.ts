import assert from "node:assert/strict";
import { test } from "node:test";
import { can, requirePolicy } from "../src/policy/policy.js";

test("policy context cannot be evaluated without an active tenant and actor", async () => {
  await assert.rejects(
    () => can("dashboard.view", { actorUserId: "actor-id" }),
    /Company context is required/,
  );
});

test("requirePolicy requires tenant context before evaluating a policy", async () => {
  await assert.rejects(
    () => requirePolicy("company.settings.edit"),
    /Company context is required/,
  );
});
