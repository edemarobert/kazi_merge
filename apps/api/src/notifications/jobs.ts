import { randomUUID } from "node:crypto";
import type { NotificationEvent } from "./contracts.js";
import { notificationEventTypes } from "./contracts.js";

function eventId(): string {
  return randomUUID();
}

function createEvent(
  type: NotificationEvent["type"],
  input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">,
): NotificationEvent {
  return { ...input, eventId: eventId(), type, occurredAt: new Date() };
}

export function taskAssignedEvent(
  input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">,
) {
  return createEvent(notificationEventTypes.taskAssigned, input);
}

export function taskDueSoonEvent(
  input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">,
) {
  return createEvent(notificationEventTypes.taskDueSoon, input);
}

export function taskOverdueEvent(
  input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">,
) {
  return createEvent(notificationEventTypes.taskOverdue, input);
}

export function taskCommentEvent(
  input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">,
) {
  return createEvent(notificationEventTypes.taskComment, input);
}

export function ownerDailyDigestEvent(
  input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">,
) {
  return createEvent(notificationEventTypes.ownerDailyDigest, input);
}

import type { NotificationQueue } from "./queue.js";

export function createNotificationJobs(queue: NotificationQueue) {
  return {
    taskAssigned(input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">) {
      return queue.enqueue({ event: taskAssignedEvent(input) });
    },
    taskDueSoon(input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">) {
      return queue.enqueue({ event: taskDueSoonEvent(input) });
    },
    taskOverdue(input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">) {
      return queue.enqueue({ event: taskOverdueEvent(input) });
    },
    taskComment(input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">) {
      return queue.enqueue({ event: taskCommentEvent(input) });
    },
    ownerDailyDigest(
      input: Omit<NotificationEvent, "eventId" | "type" | "occurredAt">,
    ) {
      return queue.enqueue({ event: ownerDailyDigestEvent(input) });
    },
  };
}
