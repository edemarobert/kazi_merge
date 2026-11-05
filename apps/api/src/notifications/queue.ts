import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import type { NotificationEvent } from "./contracts.js";

export type NotificationJob = { event: NotificationEvent };
export type NotificationJobHandler = (event: NotificationEvent) => Promise<void>;

export const notificationQueueName = "kazi-notifications";
export const notificationDeadLetterQueueName = "kazi-notifications-dead-letter";
export const notificationJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: false,
};

export interface NotificationQueue {
  enqueue(job: NotificationJob): Promise<void>;
}

export class InMemoryNotificationQueue implements NotificationQueue {
  readonly jobs: NotificationJob[] = [];

  async enqueue(job: NotificationJob): Promise<void> {
    this.jobs.push(job);
  }
}

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

export function createBullMqNotificationQueue(redisUrl: string): NotificationQueue {
  const queue = new Queue<NotificationJob>(notificationQueueName, {
    connection: connectionFromUrl(redisUrl),
  });
  return {
    async enqueue(job) {
      await queue.add(job.event.type, job, notificationJobOptions);
    },
  };
}

export function createNotificationWorker(
  redisUrl: string,
  handler: NotificationJobHandler,
) {
  const deadLetterQueue = new Queue<NotificationJob>(notificationDeadLetterQueueName, {
    connection: connectionFromUrl(redisUrl),
  });
  const worker = new Worker<NotificationJob>(
    notificationQueueName,
    async (job: Job<NotificationJob>) => handler(job.data.event),
    { connection: connectionFromUrl(redisUrl) },
  );
  worker.on("failed", async (job) => {
    if (job) await deadLetterQueue.add(job.name, job.data, { removeOnComplete: 1000 });
  });
  return worker;
}
