import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./apps/web/test",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev --workspace @kazi-merge/web",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
