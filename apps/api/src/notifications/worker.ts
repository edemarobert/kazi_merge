import { companyId, runWithCompanyContextAsync } from "../context/company-context.js";
import type { NotificationEvent } from "./contracts.js";
import { createNotificationWorker } from "./queue.js";
import type { NotificationQueue } from "./queue.js";
import {
  createNotificationService,
  type createNotificationService as NotificationServiceFactory,
} from "./service.js";
import { createInAppChannel } from "./channels.js";
import { prisma } from "../db/prisma.js";

export function createTenantNotificationWorker(
  redisUrl: string,
  service: ReturnType<typeof createNotificationService>,
) {
  return createNotificationWorker(redisUrl, async (event: NotificationEvent) => {
    await runWithCompanyContextAsync(companyId(event.companyId), () =>
      service.publish(event),
    );
  });
}

export function enqueueNotificationEvent(
  queue: NotificationQueue,
  event: NotificationEvent,
) {
  return queue.enqueue({ event });
}

export function createPrismaNotificationService() {
  return createNotificationService(
    {
      notification: {
        create: (args) => prisma.notification.create(args as never),
        update: (args) => prisma.notification.update(args as never),
      },
      preference: {
        findUnique: (args) =>
          prisma.notificationPreference.findUnique({ where: args.where }),
      },
    },
    { in_app: createInAppChannel() },
  );
}
