import { companyId, runWithCompanyContextAsync } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import type { NotificationDeliveryRecord, NotificationEvent } from "./contracts.js";
import { createInAppChannel, createJsonWebhookChannel } from "./channels.js";
import { createNotificationWorker } from "./queue.js";
import type { NotificationQueue } from "./queue.js";
import {
  createGraphWhatsAppTransport,
  createWhatsAppChannel,
} from "../whatsapp/channel.js";
import { createNotificationService } from "./service.js";

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
  const adapters: Record<
    string,
    { send(record: NotificationDeliveryRecord): Promise<unknown> }
  > = {
    in_app: createInAppChannel(),
  };
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const transport = createGraphWhatsAppTransport({
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    });
    adapters.whatsapp = {
      send: async (record) => {
        const account = await prisma.integrationAccount.findFirst({
          where: {
            userId: record.recipientUserId,
            provider: "whatsapp",
            status: "opted_in",
          },
          select: { externalId: true },
        });
        if (!account) throw new Error("Recipient has not opted in to WhatsApp.");
        return createWhatsAppChannel(account.externalId, transport).send(record);
      },
    };
  } else {
    adapters.whatsapp = {
      send: async () => {
        throw new Error("WhatsApp provider is not configured.");
      },
    };
  }
  const resolveUserContact =
    (field: "phoneE164" | "email") => async (record: NotificationDeliveryRecord) => {
      const user = await prisma.user.findUnique({
        where: { id: record.recipientUserId },
        select: { phoneE164: true, email: true },
      });
      return user?.[field] ?? null;
    };
  adapters.sms = process.env.SMS_PROVIDER_URL
    ? createJsonWebhookChannel({
        channel: "sms",
        url: process.env.SMS_PROVIDER_URL,
        token: process.env.SMS_PROVIDER_TOKEN,
        resolveRecipient: resolveUserContact("phoneE164"),
      })
    : {
        send: async () => {
          throw new Error("SMS provider is not configured.");
        },
      };
  adapters.email = process.env.EMAIL_PROVIDER_URL
    ? createJsonWebhookChannel({
        channel: "email",
        url: process.env.EMAIL_PROVIDER_URL,
        token: process.env.EMAIL_PROVIDER_TOKEN,
        resolveRecipient: resolveUserContact("email"),
      })
    : {
        send: async () => {
          throw new Error("Email provider is not configured.");
        },
      };
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
    adapters as never,
  );
}
