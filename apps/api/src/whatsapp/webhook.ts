import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundHandler } from "../notifications/service.js";

export type WhatsAppInboundRequest = {
  rawBody: Buffer;
  signature?: string;
  appSecret: string;
  body: unknown;
};

export type WhatsAppInboundEvent = {
  messageId: string;
  phoneE164: string;
  kind: "text" | "button";
  text?: string;
  buttonId?: string;
  contextMessageId?: string;
};

export function verifyWhatsAppSignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string,
): boolean {
  if (!signature?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
}

function phone(value: string): string {
  return value.startsWith("+") ? value : `+${value}`;
}

export function parseWhatsAppEvents(body: unknown): WhatsAppInboundEvent[] {
  if (!body || typeof body !== "object") return [];
  const root = body as {
    entry?: Array<{
      changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }>;
    }>;
  };
  const events: WhatsAppInboundEvent[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const id = typeof message.id === "string" ? message.id : "";
        const from = typeof message.from === "string" ? phone(message.from) : "";
        if (!id || !from) continue;
        const context =
          typeof message.context === "object" && message.context !== null
            ? (message.context as { id?: unknown })
            : undefined;
        if (message.type === "interactive") {
          const interactive = message.interactive as
            | { button_reply?: { id?: unknown }; list_reply?: { id?: unknown } }
            | undefined;
          const buttonId =
            typeof interactive?.button_reply?.id === "string"
              ? interactive.button_reply.id
              : typeof interactive?.list_reply?.id === "string"
                ? interactive.list_reply.id
                : undefined;
          if (buttonId)
            events.push({
              messageId: id,
              phoneE164: from,
              kind: "button",
              buttonId,
              contextMessageId:
                typeof context?.id === "string" ? context.id : undefined,
            });
        } else if (message.type === "text") {
          const text =
            typeof (message.text as { body?: unknown } | undefined)?.body === "string"
              ? (message.text as { body: string }).body.trim()
              : "";
          if (text)
            events.push({
              messageId: id,
              phoneE164: from,
              kind: "text",
              text,
              contextMessageId:
                typeof context?.id === "string" ? context.id : undefined,
            });
        }
      }
    }
  }
  return events;
}

export function joinToken(text: string | undefined): string | null {
  const match = text?.trim().match(/^JOIN(?:\s+)(\S+)$/i);
  return match?.[1] ?? null;
}

export function buttonAction(
  buttonId: string | undefined,
): { taskId: string; action: string } | null {
  const match = buttonId?.match(/^task:([^:]+):([a-z_]+)$/);
  return match ? { taskId: match[1], action: match[2] } : null;
}

export class WhatsAppInboundHandler
  implements InboundHandler<WhatsAppInboundRequest, WhatsAppInboundEvent>
{
  verify(request: WhatsAppInboundRequest): boolean {
    return verifyWhatsAppSignature(
      request.rawBody,
      request.signature,
      request.appSecret,
    );
  }

  parse(request: WhatsAppInboundRequest): WhatsAppInboundEvent[] {
    return parseWhatsAppEvents(request.body);
  }
}
