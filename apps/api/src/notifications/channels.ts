import type { ChannelAdapter } from "./service.js";
import type { NotificationDeliveryRecord } from "./contracts.js";

type MessageSender = (record: NotificationDeliveryRecord) => Promise<void>;

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
