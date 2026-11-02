import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";

test("health endpoint reports an available API shell", async () => {
  const server = createServer(createApp());

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const response = await fetch(`http://localhost:${address.port}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "api",
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
