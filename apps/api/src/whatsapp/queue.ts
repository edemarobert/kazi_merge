import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";

export const whatsappInboundQueueName = "kazi-whatsapp-inbound";
export type WhatsAppInboundJob = { body: unknown };

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

export function createBullMqWhatsAppInboundQueue(redisUrl: string) {
  const queue = new Queue<WhatsAppInboundJob>(whatsappInboundQueueName, {
    connection: connectionFromUrl(redisUrl),
  });
  return {
    async enqueue(job: WhatsAppInboundJob): Promise<void> {
      await queue.add("whatsapp.inbound", job, {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      });
    },
  };
}

export function createWhatsAppInboundWorker(redisUrl: string) {
  return new Worker<WhatsAppInboundJob>(
    whatsappInboundQueueName,
    async (job: Job<WhatsAppInboundJob>) => {
      const { processWhatsAppPayload } = await import("./routes.js");
      await processWhatsAppPayload(job.data.body);
    },
    { connection: connectionFromUrl(redisUrl) },
  );
}
