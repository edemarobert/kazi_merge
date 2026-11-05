import type { NotificationDeliveryRecord } from "../notifications/contracts.js";
import type {
  ChannelAdapter,
  MessagingChannel,
  OutboundMessage,
  Recipient,
} from "../notifications/service.js";

export type WhatsAppButton = { id: string; title: string };
export type WhatsAppOutboundMessage = {
  to: string;
  type: "template" | "text";
  body: string;
  template?: string;
  buttons?: WhatsAppButton[];
};

function payloadText(record: NotificationDeliveryRecord): string {
  const payload = record.payload ?? {};
  const title = typeof payload.title === "string" ? payload.title : "your task";
  const reason = typeof payload.reason === "string" ? payload.reason : "";
  return reason ? `${title}: ${reason}` : title;
}

export function renderWhatsAppMessage(
  record: NotificationDeliveryRecord,
  to: string,
): WhatsAppOutboundMessage {
  const taskId = record.taskId ?? "";
  const title = payloadText(record);
  const messages: Record<string, WhatsAppOutboundMessage> = {
    task_assigned: {
      to,
      type: "template",
      template: "task_assigned",
      body: `You have been assigned: ${title}`,
      buttons: [
        { id: `task:${taskId}:in_progress`, title: "Start" },
        { id: `task:${taskId}:open`, title: "Open in Kazi Merge" },
      ],
    },
    task_due_soon: {
      to,
      type: "template",
      template: "task_due_soon",
      body: `Due soon: ${title}`,
      buttons: [
        { id: `task:${taskId}:done`, title: "Done" },
        { id: `task:${taskId}:need_more_time`, title: "Need more time" },
      ],
    },
    task_overdue: {
      to,
      type: "template",
      template: "task_overdue",
      body: `Overdue: ${title}`,
      buttons: [
        { id: `task:${taskId}:done`, title: "Done" },
        { id: `task:${taskId}:blocked`, title: "Blocked" },
      ],
    },
    task_comment: {
      to,
      type: "template",
      template: "task_comment",
      body: `New comment on ${title}`,
      buttons: [
        { id: `task:${taskId}:reply`, title: "Reply" },
        { id: `task:${taskId}:open`, title: "Open in Kazi Merge" },
      ],
    },
    owner_daily_digest: {
      to,
      type: "template",
      template: "owner_daily_digest",
      body: `Daily work digest: ${title}`,
      buttons: [{ id: "dashboard:open", title: "Open dashboard" }],
    },
  };
  return messages[record.template] ?? { to, type: "text", body: title };
}

export type WhatsAppTransport = (
  message: WhatsAppOutboundMessage,
) => Promise<{ providerMessageId?: string }>;

export class WhatsAppChannel implements MessagingChannel {
  public constructor(private readonly transport: WhatsAppTransport) {}

  public async send(to: Recipient, message: OutboundMessage) {
    if (!to.phoneE164) throw new Error("Recipient has no phone address.");
    const result = await this.transport(renderWhatsAppMessage(message, to.phoneE164));
    return {
      status: "delivered" as const,
      sentAt: new Date(),
      providerMessageId: result.providerMessageId,
    };
  }
}

export function createWhatsAppChannel(
  to: string,
  transport: WhatsAppTransport,
): ChannelAdapter {
  return {
    async send(record) {
      return new WhatsAppChannel(transport).send({ phoneE164: to }, record);
    },
  };
}

export function createGraphWhatsAppTransport(options: {
  accessToken: string;
  phoneNumberId: string;
  fetchImpl?: typeof fetch;
}): WhatsAppTransport {
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (message) => {
    const template = message.template
      ? {
          name: message.template,
          language: { code: "en_US" },
          components: message.buttons?.length
            ? [
                { type: "body", parameters: [{ type: "text", text: message.body }] },
                ...message.buttons.map((button, index) => ({
                  type: "button",
                  sub_type: "quick_reply",
                  index: String(index),
                  parameters: [{ type: "payload", payload: button.id }],
                })),
              ]
            : undefined,
        }
      : undefined;
    const response = await fetchImpl(
      `https://graph.facebook.com/v20.0/${options.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to,
          type: template ? "template" : "text",
          ...(template ? { template } : { text: { body: message.body } }),
        }),
      },
    );
    if (!response.ok) throw new Error(`WhatsApp provider returned ${response.status}.`);
    const body = (await response.json()) as { messages?: Array<{ id?: string }> };
    return { providerMessageId: body.messages?.[0]?.id };
  };
}
