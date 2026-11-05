import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmailChannel,
  createInAppChannel,
  createSmsChannel,
} from "../src/notifications/channels.js";
import { createNotificationService } from "../src/notifications/service.js";
import { taskAssignedEvent } from "../src/notifications/jobs.js";

function event() {
  return taskAssignedEvent({
    companyId: "company-a",
    recipientUserId: "user-a",
    taskId: "task-a",
    payload: { title: "Prepare report" },
  });
}

function store(
  preferences: {
    whatsappEnabled: boolean;
    smsEnabled: boolean;
    emailEnabled: boolean;
    digestTime: string | null;
  } | null = null,
) {
  const records: Array<Record<string, unknown>> = [];
  return {
    records,
    notification: {
      async create({ data }: { data: Record<string, unknown> }) {
        const record = { id: `notification-${records.length + 1}`, ...data };
        records.push(record);
        return record;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) {
        Object.assign(records.find((record) => record.id === where.id)!, data);
      },
    },
    preference: {
      async findUnique() {
        return preferences;
      },
    },
  };
}

test("notification service creates tenant-scoped in-app and fallback deliveries", async () => {
  const database = store();
  const service = createNotificationService(database, {
    in_app: createInAppChannel(),
    sms: createSmsChannel(async () => {}),
  });
  const records = await service.publish(event());
  assert.deepEqual(
    records.map((record) => [record.channel, record.status]),
    [
      ["in_app", "delivered"],
      ["sms", "delivered"],
    ],
  );
  assert.ok(database.records.every((record) => record.companyId === "company-a"));
});

test("failed WhatsApp delivery falls back to SMS and records the failure", async () => {
  const database = store({
    whatsappEnabled: true,
    smsEnabled: true,
    emailEnabled: false,
    digestTime: null,
  });
  const service = createNotificationService(database, {
    in_app: createInAppChannel(),
    whatsapp: {
      send: async () => {
        throw new Error("provider unavailable");
      },
    },
    sms: createSmsChannel(async () => {}),
  });
  const records = await service.publish(event());
  assert.equal(
    records.find((record) => record.channel === "whatsapp")?.status,
    "failed",
  );
  assert.equal(records.find((record) => record.channel === "sms")?.status, "delivered");
  assert.equal(
    database.records.find((record) => record.channel === "whatsapp")?.error,
    "provider unavailable",
  );
});

test("email and SMS adapters expose a delivery result", async () => {
  const record = {
    ...event(),
    channel: "email" as const,
    template: "task_assigned" as const,
    status: "queued" as const,
  };
  assert.equal(
    (await createEmailChannel(async () => {}).send(record)).status,
    "delivered",
  );
  assert.equal(
    (await createSmsChannel(async () => {}).send({ ...record, channel: "sms" })).status,
    "delivered",
  );
});
