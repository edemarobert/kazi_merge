import { createHmac } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGraphWhatsAppTransport,
  renderWhatsAppMessage,
} from "../src/whatsapp/channel.js";
import {
  buttonAction,
  joinToken,
  parseWhatsAppEvents,
  verifyWhatsAppSignature,
} from "../src/whatsapp/webhook.js";

test("WhatsApp webhook signatures are verified with the raw body", () => {
  const raw = Buffer.from('{"entry":[]}');
  const signature = `sha256=${createHmac("sha256", "secret").update(raw).digest("hex")}`;
  assert.equal(verifyWhatsAppSignature(raw, signature, "secret"), true);
  assert.equal(verifyWhatsAppSignature(raw, signature, "wrong"), false);
  assert.equal(verifyWhatsAppSignature(raw, "sha256=bad", "secret"), false);
});

test("WhatsApp events parse text, button, and task context", () => {
  const events = parseWhatsAppEvents({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: "m1",
                  from: "256700000000",
                  type: "text",
                  text: { body: "hello" },
                },
                {
                  id: "m2",
                  from: "256700000000",
                  type: "interactive",
                  context: { id: "outbound-1" },
                  interactive: { button_reply: { id: "task:t1:done" } },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.deepEqual(events, [
    {
      messageId: "m1",
      phoneE164: "+256700000000",
      kind: "text",
      text: "hello",
      contextMessageId: undefined,
    },
    {
      messageId: "m2",
      phoneE164: "+256700000000",
      kind: "button",
      buttonId: "task:t1:done",
      contextMessageId: "outbound-1",
    },
  ]);
});

test("JOIN and task actions are parsed without accepting arbitrary commands", () => {
  assert.equal(joinToken("JOIN invite-token"), "invite-token");
  assert.equal(joinToken("JOIN"), null);
  assert.deepEqual(buttonAction("task:t1:blocked"), {
    taskId: "t1",
    action: "blocked",
  });
  assert.equal(buttonAction("task:t1:drop table"), null);
});

test("approved notification templates produce WhatsApp buttons", () => {
  const message = renderWhatsAppMessage(
    {
      eventId: "e1",
      companyId: "c1",
      recipientUserId: "u1",
      type: "task_due_soon",
      taskId: "t1",
      channel: "whatsapp",
      template: "task_due_soon",
      status: "queued",
      payload: { title: "Report" },
    },
    "+256700000000",
  );
  assert.equal(message.template, "task_due_soon");
  assert.deepEqual(
    message.buttons?.map((button) => button.id),
    ["task:t1:done", "task:t1:need_more_time"],
  );
});

test("Graph transport sends an approved template with quick-reply payloads", async () => {
  let request: RequestInit | undefined;
  const transport = createGraphWhatsAppTransport({
    accessToken: "token",
    phoneNumberId: "phone-id",
    fetchImpl: async (_url, init) => {
      request = init;
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), {
        status: 200,
      });
    },
  });
  const result = await transport(
    renderWhatsAppMessage(
      {
        eventId: "e1",
        companyId: "c1",
        recipientUserId: "u1",
        type: "task_assigned",
        taskId: "t1",
        channel: "whatsapp",
        template: "task_assigned",
        status: "queued",
        payload: { title: "Report" },
      },
      "+256700000000",
    ),
  );
  const body = JSON.parse(String(request?.body)) as {
    type: string;
    template: { name: string; components: Array<{ type: string }> };
  };
  assert.equal(result.providerMessageId, "wamid.1");
  assert.equal(body.type, "template");
  assert.equal(body.template.name, "task_assigned");
  assert.equal(
    body.template.components.filter((part) => part.type === "button").length,
    2,
  );
});
