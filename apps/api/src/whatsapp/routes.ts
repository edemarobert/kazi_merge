import { Prisma } from "@prisma/client";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createHash } from "node:crypto";
import { companyId, runWithCompanyContextAsync } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { createBullMqNotificationQueue } from "../notifications/queue.js";
import { createCalendarSyncQueue } from "../integrations/google-calendar-queue.js";
import { createBullMqWhatsAppInboundQueue } from "./queue.js";
import { taskCommentEvent } from "../notifications/jobs.js";
import {
  buttonAction,
  joinToken,
  parseWhatsAppEvents,
  verifyWhatsAppSignature,
  type WhatsAppInboundEvent,
} from "./webhook.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const pendingBlockedReasons = new Map<string, string>();
const pendingCommentTasks = new Map<string, string>();
function actorKey(identity: InboundIdentity): string {
  return `${identity.companyId}:${identity.userId}`;
}

async function sendText(to: string, body: string): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return;
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "text",
        text: { body },
      }),
    },
  );
  if (!response.ok) throw new Error(`WhatsApp provider returned ${response.status}.`);
}

type InboundIdentity = {
  id: string;
  companyId: string;
  userId: string;
  status: string;
  whatsappWindowExpiresAt: Date | null;
};

async function findIdentity(
  phoneE164: string,
  tenantId?: string,
): Promise<InboundIdentity | null> {
  const tenantFilter = tenantId
    ? Prisma.sql`AND ia.company_id = ${tenantId}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<InboundIdentity[]>(Prisma.sql`
    SELECT ia.id, ia.company_id AS "companyId", ia.user_id AS "userId", ia.status,
      ia.whatsapp_window_expires_at AS "whatsappWindowExpiresAt"
    FROM integration_accounts ia
    INNER JOIN memberships m ON m.company_id = ia.company_id AND m.user_id = ia.user_id
    WHERE ia.provider = 'whatsapp' AND ia.external_id = ${phoneE164}
      AND ia.status = 'opted_in' AND m.status = 'active' ${tenantFilter}
  `);
  if (rows.length > 1)
    throw new Error("WhatsApp identity is ambiguous across active tenants.");
  return rows[0] ?? null;
}
async function findInvite(
  token: string,
): Promise<{ id: string; companyId: string; userId: string } | null> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; companyId: string; userId: string }>
  >(
    Prisma.sql`SELECT id, company_id AS "companyId", invitee_user_id AS "userId" FROM invites WHERE token_hash = ${hash(token)} AND accepted_at IS NULL AND expires_at > NOW() LIMIT 1`,
  );
  return rows[0] ?? null;
}

async function handleJoin(event: WhatsAppInboundEvent, token: string): Promise<void> {
  const invite = await findInvite(token);
  if (!invite) {
    await sendText(event.phoneE164, "That JOIN link is invalid or expired.");
    return;
  }
  const duplicate = await runWithCompanyContextAsync(
    companyId(invite.companyId),
    async () => {
      try {
        await prisma.whatsAppInboundMessage.create({
          data: {
            companyId: invite.companyId,
            messageId: event.messageId,
            phoneE164: event.phoneE164,
          },
        });
        return false;
      } catch (error) {
        return (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        );
      }
    },
  );
  if (duplicate) return;
  await runWithCompanyContextAsync(companyId(invite.companyId), async () => {
    await prisma.membership.update({
      where: {
        companyId_userId: { companyId: invite.companyId, userId: invite.userId },
      },
      data: { status: "active" },
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    await prisma.integrationAccount.upsert({
      where: {
        companyId_provider_externalId: {
          companyId: invite.companyId,
          provider: "whatsapp",
          externalId: event.phoneE164,
        },
      },
      create: {
        companyId: invite.companyId,
        userId: invite.userId,
        provider: "whatsapp",
        externalId: event.phoneE164,
        scopes: ["messaging"],
        status: "opted_in",
      },
      update: {
        userId: invite.userId,
        scopes: ["messaging"],
        status: "opted_in",
        whatsappWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await prisma.notificationPreference.upsert({
      where: {
        companyId_userId: { companyId: invite.companyId, userId: invite.userId },
      },
      create: {
        companyId: invite.companyId,
        userId: invite.userId,
        whatsappEnabled: true,
      },
      update: { whatsappEnabled: true },
    });
    await prisma.activityLog.create({
      data: {
        companyId: invite.companyId,
        actorUserId: invite.userId,
        action: "whatsapp.opted_in",
        entityType: "User",
        entityId: invite.userId,
        metadata: { messageId: event.messageId },
      },
    });
  });
  await sendText(
    event.phoneE164,
    "You are connected to Kazi Merge. Test message received.",
  );
}

async function handleStop(
  event: WhatsAppInboundEvent,
  identity: InboundIdentity,
): Promise<void> {
  await runWithCompanyContextAsync(companyId(identity.companyId), async () => {
    await prisma.integrationAccount.update({
      where: { id_companyId: { id: identity.id, companyId: identity.companyId } },
      data: { status: "opted_out" },
    });
    await prisma.notificationPreference.upsert({
      where: {
        companyId_userId: { companyId: identity.companyId, userId: identity.userId },
      },
      create: {
        companyId: identity.companyId,
        userId: identity.userId,
        whatsappEnabled: false,
      },
      update: { whatsappEnabled: false },
    });
    await prisma.activityLog.create({
      data: {
        companyId: identity.companyId,
        actorUserId: identity.userId,
        action: "whatsapp.opted_out",
        entityType: "User",
        entityId: identity.userId,
        metadata: { messageId: event.messageId },
      },
    });
  });
  await sendText(
    event.phoneE164,
    "WhatsApp notifications are turned off. You can re-enable them from a new invite link.",
  );
}

async function handleTaskAction(
  event: WhatsAppInboundEvent,
  identity: InboundIdentity,
  action: { taskId: string; action: string },
): Promise<void> {
  if (action.action === "reply") {
    pendingCommentTasks.set(actorKey(identity), action.taskId);
    await sendText(event.phoneE164, "Reply with your note for this task.");
    return;
  }
  if (action.action === "blocked") {
    pendingBlockedReasons.set(actorKey(identity), action.taskId);
    await sendText(
      event.phoneE164,
      "Reply with one short reason after the Blocked button.",
    );
    return;
  }
  const status =
    action.action === "done"
      ? "done"
      : action.action === "in_progress"
        ? "in_progress"
        : null;
  if (!status) return;
  await runWithCompanyContextAsync(companyId(identity.companyId), async () => {
    const employee = await prisma.employee.findFirst({
      where: {
        membership: { userId: identity.userId },
        status: "active",
        deletedAt: null,
      },
      select: { id: true },
    });
    const task = await prisma.task.findFirst({
      where: { id: action.taskId, assigneeEmployeeId: employee?.id, deletedAt: null },
      include: { createdBy: { include: { membership: { select: { userId: true } } } } },
    });
    if (!employee || !task) {
      await sendText(event.phoneE164, "That task is no longer available to you.");
      return;
    }
    const updated = await prisma.task.update({
      where: { id_companyId: { id: task.id, companyId: identity.companyId } },
      data: { status, completedAt: status === "done" ? new Date() : null },
    });
    await prisma.taskUpdate.create({
      data: {
        companyId: identity.companyId,
        taskId: updated.id,
        authorEmployeeId: employee.id,
        kind: "status_change",
        body: `Status changed to ${status} via WhatsApp.`,
        channel: "whatsapp",
      },
    });
    await prisma.activityLog.create({
      data: {
        companyId: identity.companyId,
        actorUserId: identity.userId,
        action: "task.status_changed",
        entityType: "Task",
        entityId: updated.id,
        metadata: {
          from: task.status,
          to: status,
          channel: "whatsapp",
          messageId: event.messageId,
        },
      },
    });
    if (status === "done" && process.env.REDIS_URL) {
      const calendarQueue = createCalendarSyncQueue(process.env.REDIS_URL);
      await calendarQueue.enqueue({
        companyId: identity.companyId,
        taskId: updated.id,
        operation: "remove",
      });
    }
    if (status === "done" && process.env.REDIS_URL) {
      const queue = createBullMqNotificationQueue(process.env.REDIS_URL);
      await queue.enqueue({
        event: taskCommentEvent({
          companyId: identity.companyId,
          recipientUserId: task.createdBy.membership.userId,
          taskId: task.id,
          payload: { title: `${task.title} was completed via WhatsApp` },
        }),
      });
    }
  });
  await sendText(
    event.phoneE164,
    status === "done" ? "Marked done." : "Marked in progress.",
  );
}

async function handleBlockedReason(
  event: WhatsAppInboundEvent,
  identity: InboundIdentity,
  reason: string,
): Promise<void> {
  const taskId = pendingBlockedReasons.get(actorKey(identity));
  if (!taskId) return;
  pendingBlockedReasons.delete(actorKey(identity));
  await runWithCompanyContextAsync(companyId(identity.companyId), async () => {
    const employee = await prisma.employee.findFirst({
      where: {
        membership: { userId: identity.userId },
        status: "active",
        deletedAt: null,
      },
      select: { id: true },
    });
    const task = await prisma.task.findFirst({
      where: { id: taskId, assigneeEmployeeId: employee?.id, deletedAt: null },
      select: { id: true },
    });
    if (!employee || !task) return;
    const updated = await prisma.task.update({
      where: { id_companyId: { id: task.id, companyId: identity.companyId } },
      data: { status: "blocked", blockedReason: reason, completedAt: null },
    });
    await prisma.taskUpdate.create({
      data: {
        companyId: identity.companyId,
        taskId: updated.id,
        authorEmployeeId: employee.id,
        kind: "status_change",
        body: `Status changed to blocked: ${reason} via WhatsApp.`,
        channel: "whatsapp",
      },
    });
    await prisma.activityLog.create({
      data: {
        companyId: identity.companyId,
        actorUserId: identity.userId,
        action: "task.status_changed",
        entityType: "Task",
        entityId: updated.id,
        metadata: {
          to: "blocked",
          blockedReason: reason,
          channel: "whatsapp",
          messageId: event.messageId,
        },
      },
    });
  });
  await sendText(event.phoneE164, "Marked blocked with your reason.");
}
async function sendOpenTaskList(
  phoneE164: string,
  identity: InboundIdentity,
): Promise<void> {
  const tasks = await runWithCompanyContextAsync(
    companyId(identity.companyId),
    async () => {
      const employee = await prisma.employee.findFirst({
        where: {
          membership: { userId: identity.userId },
          status: "active",
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!employee) return [];
      return prisma.task.findMany({
        where: {
          assigneeEmployeeId: employee.id,
          deletedAt: null,
          status: { in: ["todo", "in_progress", "blocked"] },
        },
        select: { id: true, title: true, status: true },
        orderBy: { dueAt: "asc" },
        take: 10,
      });
    },
  );
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID)
    return;
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneE164.replace("+", ""),
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Choose an open task for your note." },
          action: {
            button: "Choose task",
            sections: [
              {
                title: "Open tasks",
                rows: tasks.map((task) => ({
                  id: `task:${task.id}:reply`,
                  title: task.title.slice(0, 24),
                  description: task.status,
                })),
              },
            ],
          },
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`WhatsApp provider returned ${response.status}.`);
}

async function handleComment(
  event: WhatsAppInboundEvent,
  identity: InboundIdentity,
): Promise<void> {
  const taskFromSelection = pendingCommentTasks.get(actorKey(identity));
  const withinReplyWindow =
    identity.whatsappWindowExpiresAt !== null &&
    identity.whatsappWindowExpiresAt.getTime() > Date.now();
  const notification = event.contextMessageId
    ? await runWithCompanyContextAsync(companyId(identity.companyId), () =>
        prisma.notification.findFirst({
          where: {
            providerMessageId: event.contextMessageId,
            recipientUserId: identity.userId,
            channel: "whatsapp",
            taskId: { not: null },
          },
          select: { taskId: true },
        }),
      )
    : null;
  const taskId = notification?.taskId ?? taskFromSelection;
  if (!withinReplyWindow || !taskId || !event.text) {
    await sendOpenTaskList(event.phoneE164, identity);
    return;
  }
  pendingCommentTasks.delete(actorKey(identity));
  await runWithCompanyContextAsync(companyId(identity.companyId), async () => {
    const employee = await prisma.employee.findFirst({
      where: {
        membership: { userId: identity.userId },
        status: "active",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!employee) return;
    await prisma.taskUpdate.create({
      data: {
        companyId: identity.companyId,
        taskId,
        authorEmployeeId: employee.id,
        kind: "comment",
        body: event.text ?? "",
        channel: "whatsapp",
      },
    });
    await prisma.activityLog.create({
      data: {
        companyId: identity.companyId,
        actorUserId: identity.userId,
        action: "task.comment_added",
        entityType: "Task",
        entityId: taskId,
        metadata: { channel: "whatsapp", messageId: event.messageId },
      },
    });
  });
  await sendText(event.phoneE164, "Your note was added to the task.");
}
async function processEvent(event: WhatsAppInboundEvent): Promise<void> {
  const identity = await findIdentity(event.phoneE164);
  const token = joinToken(event.text);
  if (token) {
    await handleJoin(event, token);
    return;
  }
  if (!identity) {
    await sendText(event.phoneE164, "Please use your Kazi Merge invite link first.");
    return;
  }
  const duplicate = await runWithCompanyContextAsync(
    companyId(identity.companyId),
    async () => {
      try {
        await prisma.whatsAppInboundMessage.create({
          data: {
            companyId: identity!.companyId,
            messageId: event.messageId,
            phoneE164: event.phoneE164,
          },
        });
        return false;
      } catch (error) {
        return (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        );
      }
    },
  );
  if (duplicate) return;
  await runWithCompanyContextAsync(companyId(identity.companyId), () =>
    prisma.integrationAccount.update({
      where: { id_companyId: { id: identity.id, companyId: identity.companyId } },
      data: { whatsappWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    }),
  );
  if (event.kind === "text" && event.text?.trim().toUpperCase() === "STOP") {
    await handleStop(event, identity);
    return;
  }
  if (identity.status !== "opted_in") {
    await sendText(
      event.phoneE164,
      "WhatsApp notifications are turned off. Use a new invite link to reconnect.",
    );
    return;
  }
  if (
    event.kind === "text" &&
    event.text &&
    pendingBlockedReasons.has(actorKey(identity))
  ) {
    await handleBlockedReason(event, identity, event.text);
    return;
  }
  const action = buttonAction(event.buttonId);
  if (action) {
    await handleTaskAction(event, identity, action);
    return;
  }
  if (event.kind === "text") await handleComment(event, identity);
}

export function createWhatsAppRouter() {
  const router = Router();
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  router.get("/webhook", (request, response) => {
    const mode = request.query["hub.mode"];
    const token = request.query["hub.verify_token"];
    const challenge = request.query["hub.challenge"];
    if (
      mode === "subscribe" &&
      token === process.env.WHATSAPP_VERIFY_TOKEN &&
      typeof challenge === "string"
    ) {
      response.status(200).send(challenge);
      return;
    }
    response.sendStatus(403);
  });
  router.post("/webhook", async (request, response, next) => {
    try {
      const raw =
        (request as typeof request & { rawBody?: Buffer }).rawBody ??
        Buffer.from(JSON.stringify(request.body ?? {}));
      if (
        !verifyWhatsAppSignature(
          raw,
          request.header("x-hub-signature-256"),
          process.env.WHATSAPP_APP_SECRET ?? "",
        )
      ) {
        response.sendStatus(401);
        return;
      }
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        response.sendStatus(503);
        return;
      }
      const queue = createBullMqWhatsAppInboundQueue(redisUrl);
      await queue.enqueue({ body: request.body });
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export async function processWhatsAppPayload(body: unknown): Promise<void> {
  for (const event of parseWhatsAppEvents(body)) await processEvent(event);
}
