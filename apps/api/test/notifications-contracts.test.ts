import assert from "node:assert/strict";
import { test } from "node:test";
import {
  notificationChannels,
  notificationDeliveryStatuses,
  notificationEventTypes,
  notificationTemplates,
} from "../src/notifications/contracts.js";

test("notification contracts define the five approved event templates", () => {
  assert.deepEqual(Object.values(notificationEventTypes), [
    "task_assigned",
    "task_due_soon",
    "task_overdue",
    "task_comment",
    "owner_daily_digest",
  ]);
  assert.deepEqual(
    Object.values(notificationTemplates),
    Object.values(notificationEventTypes),
  );
});

test("notification contracts define fallback delivery channels and lifecycle statuses", () => {
  assert.deepEqual(Object.values(notificationChannels), [
    "in_app",
    "whatsapp",
    "sms",
    "email",
  ]);
  assert.deepEqual(Object.values(notificationDeliveryStatuses), [
    "queued",
    "sent",
    "delivered",
    "failed",
  ]);
});
