import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import { companyId, runWithCompanyContextAsync } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
import { decryptIntegrationToken } from "../auth/token-crypto.js";
import { googleCalendarScope, readGoogleConfig } from "../auth/google.js";
import { GoogleCalendarSync } from "./google-calendar.js";

export const calendarSyncQueueName = "kazi-calendar-sync";

export type CalendarSyncJob = {
  companyId: string;
  taskId: string;
  operation: "upsert" | "remove";
};

function connectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

export function createCalendarSyncQueue(redisUrl: string) {
  const queue = new Queue<CalendarSyncJob>(calendarSyncQueueName, {
    connection: connectionFromUrl(redisUrl),
  });
  return {
    async enqueue(job: CalendarSyncJob): Promise<void> {
      await queue.add("task-calendar-" + job.operation, job, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      });
    },
  };
}

export async function syncTaskDueDateToGoogleCalendar(
  job: CalendarSyncJob,
): Promise<void> {
  const config = readGoogleConfig();
  if (!config) return;

  await runWithCompanyContextAsync(companyId(job.companyId), async () => {
    const task = await prisma.task.findFirst({
      where: {
        id: job.taskId,
        ...(job.operation === "upsert"
          ? { dueAt: { not: null }, deletedAt: null }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        googleCalendarEventId: true,
        assignee: {
          select: { membership: { select: { userId: true } } },
        },
      },
    });
    if (!task?.assignee.membership) return;
    if (job.operation === "upsert" && !task.dueAt) return;
    if (job.operation === "remove" && !task.googleCalendarEventId) return;

    const account = await prisma.integrationAccount.findFirst({
      where: {
        companyId: job.companyId,
        userId: task.assignee.membership.userId,
        provider: "google",
        status: "active",
        scopes: { has: googleCalendarScope },
        encryptedToken: { not: null },
      },
      select: { encryptedToken: true },
    });
    if (!account?.encryptedToken) return;

    const sync = new GoogleCalendarSync(
      decryptIntegrationToken(account.encryptedToken),
      config,
    );
    if (job.operation === "remove") {
      await sync.removeTaskEvent(task.googleCalendarEventId!, {
        id: task.assignee.membership.userId,
      });
      await prisma.task.update({
        where: { id_companyId: { id: task.id, companyId: job.companyId } },
        data: { googleCalendarEventId: null },
      });
      return;
    }

    await sync.upsertTaskEvent(
      {
        id: task.id,
        title: task.title,
        description: task.description,
        dueAt: task.dueAt!,
        googleCalendarEventId: task.googleCalendarEventId,
      },
      { id: task.assignee.membership.userId },
    );
    if (sync.lastEventId) {
      await prisma.task.update({
        where: { id_companyId: { id: task.id, companyId: job.companyId } },
        data: { googleCalendarEventId: sync.lastEventId },
      });
    }
  });
}

export function createCalendarSyncWorker(redisUrl: string) {
  return new Worker<CalendarSyncJob>(
    calendarSyncQueueName,
    async (job: Job<CalendarSyncJob>) => syncTaskDueDateToGoogleCalendar(job.data),
    { connection: connectionFromUrl(redisUrl) },
  );
}
