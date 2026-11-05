import { expect, test } from "playwright/test";

const emptyDashboard = {
  companyName: null,
  trialDays: null,
  metrics: {
    openTasks: 0,
    overdue: 0,
    dueThisWeek: 0,
    blocked: 0,
    onTimeCompletionRate: null,
  },
  workload: [],
  activity: [],
};

test.describe("dashboard states", () => {
  test("shows loading feedback while dashboard data is pending", async ({ page }) => {
    await page.route("**/api/v1/dashboard", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ json: emptyDashboard });
    });

    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Loading dashboard...");
  });

  test("shows empty workload and activity states", async ({ page }) => {
    await page.route("**/api/v1/dashboard", (route) =>
      route.fulfill({ json: emptyDashboard }),
    );

    await page.goto("/");
    await expect(page.getByText("No workload data yet.")).toBeVisible();
    await expect(page.getByText("No recent activity yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open tasks/ })).toHaveAttribute(
      "href",
      "/tasks?open=true",
    );
    await expect(page.getByRole("link", { name: /Overdue/ })).toHaveAttribute(
      "href",
      "/tasks?overdue=true",
    );
    await expect(page.getByRole("link", { name: /Due this week/ })).toHaveAttribute(
      "href",
      "/tasks?dueThisWeek=true",
    );
    await expect(page.getByRole("link", { name: /Blocked/ })).toHaveAttribute(
      "href",
      "/tasks?status=blocked",
    );
  });

  test("shows an error alert when dashboard data fails", async ({ page }) => {
    await page.route("**/api/v1/dashboard", (route) =>
      route.fulfill({ status: 500, json: { message: "Dashboard unavailable." } }),
    );

    await page.goto("/");
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "Dashboard data is unavailable.",
    );
  });
});
