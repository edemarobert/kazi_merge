import assert from "node:assert/strict";
import { test } from "node:test";
import { GoogleCalendarSync } from "../src/integrations/google-calendar.js";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost/callback",
  stateSecret: "state-secret",
};

test("GoogleCalendarSync refreshes the token and creates a due-date event", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    {
      ok: true,
      json: async () => ({ access_token: "access-token" }),
    },
    {
      ok: true,
      json: async () => ({ id: "calendar-event-id" }),
    },
  ];
  const sync = new GoogleCalendarSync("refresh-token", config, async (url, init) => {
    calls.push({ url: String(url), init });
    const response = responses.shift();
    assert.ok(response);
    return response as Response;
  });

  await sync.upsertTaskEvent(
    {
      id: "task-id",
      title: "Prepare report",
      description: "Bring the latest figures.",
      dueAt: new Date("2026-11-06T09:00:00.000Z"),
      googleCalendarEventId: null,
    },
    { id: "user-id" },
  );

  assert.equal(sync.lastEventId, "calendar-event-id");
  assert.equal(calls[0]?.url, "https://oauth2.googleapis.com/token");
  assert.equal(
    calls[1]?.url,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  assert.equal(calls[1]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
    summary: "Prepare report",
    description: "Bring the latest figures.",
    start: { dateTime: "2026-11-06T09:00:00.000Z", timeZone: "UTC" },
    end: { dateTime: "2026-11-06T10:00:00.000Z", timeZone: "UTC" },
  });
});

test("GoogleCalendarSync removes an existing event and tolerates an already deleted event", async () => {
  const methods: string[] = [];
  const sync = new GoogleCalendarSync("refresh-token", config, async (_url, init) => {
    methods.push(init?.method ?? "GET");
    if (methods.length === 1) {
      return {
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });

  await sync.removeTaskEvent("calendar-event-id", { id: "user-id" });
  assert.deepEqual(methods, ["POST", "DELETE"]);
});
