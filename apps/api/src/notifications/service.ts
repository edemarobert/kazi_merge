import {
  notificationChannels,
  notificationDeliveryStatuses,
  type NotificationChannel,
  type NotificationDeliveryRecord,
  type NotificationEvent,
} from "./contracts.js";

export type NotificationPreferenceRecord = {
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  digestTime: string | null;
};

type DeliveryStore = {
  notification: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  preference: {
    findUnique(args: {
      where: { companyId_userId: { companyId: string; userId: string } };
    }): Promise<NotificationPreferenceRecord | null>;
  };
};

export type Recipient = { phoneE164?: string; email?: string };
export type OutboundMessage = NotificationDeliveryRecord;
export type DeliveryResult = {
  status: "sent" | "delivered";
  sentAt?: Date;
  providerMessageId?: string;
};

export interface MessagingChannel {
  send(to: Recipient, message: OutboundMessage): Promise<DeliveryResult>;
}

export interface InboundHandler<TRequest = unknown, TEvent = unknown> {
  verify(request: TRequest): boolean;
  parse(request: TRequest): TEvent[];
}
export type ChannelAdapter = {
  send(record: NotificationDeliveryRecord): Promise<{
    status: "sent" | "delivered";
    sentAt?: Date;
    providerMessageId?: string;
  }>;
};

export type NotificationAdapters = Partial<Record<NotificationChannel, ChannelAdapter>>;

function externalChannelOrder(
  preferences: NotificationPreferenceRecord,
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (preferences.whatsappEnabled) channels.push(notificationChannels.whatsapp);
  if (preferences.smsEnabled) channels.push(notificationChannels.sms);
  if (preferences.emailEnabled) channels.push(notificationChannels.email);
  return channels;
}

export function createNotificationService(
  store: DeliveryStore,
  adapters: NotificationAdapters,
) {
  return {
    async publish(event: NotificationEvent): Promise<NotificationDeliveryRecord[]> {
      const preferences = (await store.preference.findUnique({
        where: {
          companyId_userId: {
            companyId: event.companyId,
            userId: event.recipientUserId,
          },
        },
      })) ?? {
        whatsappEnabled: false,
        smsEnabled: true,
        emailEnabled: true,
        digestTime: null,
      };

      const records: NotificationDeliveryRecord[] = [];
      const channels = [
        notificationChannels.inApp,
        ...externalChannelOrder(preferences),
      ];
      let externalDelivered = false;
      for (const channel of channels) {
        if (channel !== notificationChannels.inApp && externalDelivered) break;
        const record: NotificationDeliveryRecord = {
          eventId: event.eventId,
          companyId: event.companyId,
          recipientUserId: event.recipientUserId,
          type: event.type,
          taskId: event.taskId,
          channel,
          template: event.type,
          status: notificationDeliveryStatuses.queued,
          payload: event.payload,
        };
        const created = (await store.notification.create({
          data: {
            companyId: record.companyId,
            recipientUserId: record.recipientUserId,
            type: record.type,
            taskId: record.taskId,
            channel: record.channel,
            template: record.template,
            status: record.status,
          },
        })) as { id: string };
        const adapter = adapters[channel];
        if (!adapter) {
          records.push(record);
          continue;
        }
        try {
          const result = await adapter.send(record);
          await store.notification.update({
            where: { id: created.id },
            data: {
              status: result.status,
              sentAt: result.sentAt ?? new Date(),
              ...(result.providerMessageId
                ? { providerMessageId: result.providerMessageId }
                : {}),
              error: null,
            },
          });
          record.status = result.status;
          record.sentAt = result.sentAt ?? new Date();
          records.push(record);
          if (result.providerMessageId)
            record.providerMessageId = result.providerMessageId;
          if (channel !== notificationChannels.inApp) externalDelivered = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Delivery failed.";
          await store.notification.update({
            where: { id: created.id },
            data: {
              status: notificationDeliveryStatuses.failed,
              error: message,
            },
          });
          record.status = notificationDeliveryStatuses.failed;
          record.error = message;
          records.push(record);
        }
      }
      return records;
    },
  };
}
