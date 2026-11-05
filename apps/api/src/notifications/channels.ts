import type {
  ChannelAdapter,
  MessagingChannel,
  OutboundMessage,
  Recipient,
} from "./service.js";
import type { NotificationDeliveryRecord } from "./contracts.js";

type MessageSender = (record: NotificationDeliveryRecord) => Promise<void>;

export class SmsChannel implements MessagingChannel {
  public constructor(private readonly sender: MessageSender) {}
  public async send(_to: Recipient, message: OutboundMessage) {
    await this.sender(message);
    return { status: "delivered" as const, sentAt: new Date() };
  }
}

export class EmailChannel implements MessagingChannel {
  public constructor(private readonly sender: MessageSender) {}
  public async send(_to: Recipient, message: OutboundMessage) {
    await this.sender(message);
    return { status: "delivered" as const, sentAt: new Date() };
  }
}

export class InAppChannel implements MessagingChannel {
  public async send(_to: Recipient, _message: OutboundMessage) {
    return { status: "delivered" as const, sentAt: new Date() };
  }
}

function messageText(record: NotificationDeliveryRecord): string {
  const payload = record.payload ?? {};
  const title = typeof payload.title === "string" ? payload.title : "your task";
  const reason = typeof payload.reason === "string" ? payload.reason : "";
  return reason ? `${title}: ${reason}` : title;
}

function createTransportAdapter(sender: MessageSender): ChannelAdapter {
  return {
    async send(record) {
      await sender(record);
      return { status: "delivered", sentAt: new Date() };
    },
  };
}

export function createInAppChannel(): ChannelAdapter {
  return {
    async send() {
      return { status: "delivered", sentAt: new Date() };
    },
  };
}
export function createEmailChannel(sender: MessageSender): ChannelAdapter {
  return createTransportAdapter(sender);
}
export function createSmsChannel(sender: MessageSender): ChannelAdapter {
  return createTransportAdapter(sender);
}

export function createJsonWebhookChannel(options: {
  channel: "sms" | "email";
  url: string;
  token?: string;
  resolveRecipient: (record: NotificationDeliveryRecord) => Promise<string | null>;
  fetchImpl?: typeof fetch;
}): ChannelAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async send(record) {
      const recipient = await options.resolveRecipient(record);
      if (!recipient) throw new Error(`Recipient has no ${options.channel} address.`);
      const response = await fetchImpl(options.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: JSON.stringify({
          channel: options.channel,
          to: recipient,
          template: record.template,
          text: messageText(record),
          taskId: record.taskId,
          eventId: record.eventId,
        }),
      });
      if (!response.ok)
        throw new Error(`${options.channel} provider returned ${response.status}.`);
      const body = (await response.json().catch(() => ({}))) as {
        providerMessageId?: string;
        id?: string;
      };
      return {
        status: "delivered" as const,
        sentAt: new Date(),
        providerMessageId: body.providerMessageId ?? body.id,
      };
    },
  };
}
