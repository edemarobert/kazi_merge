import { createApp } from "./app.js";
import {
  createPrismaNotificationService,
  createTenantNotificationWorker,
} from "./notifications/worker.js";
import { createWhatsAppInboundWorker } from "./whatsapp/queue.js";
import { createNotificationScheduler } from "./notifications/scheduler.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

if (process.env.REDIS_URL) {
  createTenantNotificationWorker(
    process.env.REDIS_URL,
    createPrismaNotificationService(),
  );
  createWhatsAppInboundWorker(process.env.REDIS_URL);
  void createNotificationScheduler(process.env.REDIS_URL).register();
}

app.listen(port, () => {
  console.log(`Kazi Merge API listening on http://localhost:${port}`);
});
