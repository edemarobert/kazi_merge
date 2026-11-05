import { createApp } from "./app.js";
import {
  createPrismaNotificationService,
  createTenantNotificationWorker,
} from "./notifications/worker.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

if (process.env.REDIS_URL) {
  createTenantNotificationWorker(
    process.env.REDIS_URL,
    createPrismaNotificationService(),
  );
}

app.listen(port, () => {
  console.log(`Kazi Merge API listening on http://localhost:${port}`);
});
