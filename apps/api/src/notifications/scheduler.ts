import { Queue, type ConnectionOptions } from "bullmq";

export const notificationScheduleDefinitions = [
  { name: "notifications.due-soon", kind: "due-soon", pattern: "*/5 * * * *" },
  { name: "notifications.overdue", kind: "overdue", pattern: "*/15 * * * *" },
  {
    name: "notifications.owner-daily-digest",
    kind: "owner-daily-digest",
    pattern: "0 * * * *",
  },
] as const;

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

export function createNotificationScheduler(redisUrl: string) {
  const queue = new Queue("kazi-notification-scheduler", {
    connection: connectionFromUrl(redisUrl),
  });
  return {
    async register(): Promise<void> {
      for (const definition of notificationScheduleDefinitions) {
        await queue.upsertJobScheduler(
          definition.name,
          { pattern: definition.pattern },
          {
            name: definition.name,
            data: { kind: definition.kind },
            opts: { removeOnComplete: 1000, removeOnFail: false },
          },
        );
      }
    },
  };
}
