import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompanyOnboardingService } from "../src/companies/onboarding.js";

function createStore() {
  let companyNumber = 0;
  const calls: string[] = [];
  return {
    calls,
    company: {
      async create() {
        calls.push("company.create");
        companyNumber += 1;
        return {
          id: `company-${companyNumber}`,
        };
      },
    },
    membership: {
      async create({ data }: { data: Record<string, unknown> }) {
        calls.push("membership.create");
        assert.equal(data.role, "owner");
        assert.equal(data.status, "active");
        return { id: "membership-1" };
      },
    },
    employee: {
      async create({ data }: { data: Record<string, unknown> }) {
        calls.push("employee.create");
        assert.equal(data.jobTitle, "Owner");
        return { id: "employee-1" };
      },
    },
    activityLog: {
      async create({ data }: { data: Record<string, unknown> }) {
        calls.push("activityLog.create");
        assert.equal(data.action, "company.created");
        return { id: "activity-1" };
      },
    },
    async $transaction<T>(
      callback: (transaction: typeof this) => Promise<T>,
    ): Promise<T> {
      return callback(this);
    },
  };
}

test("company creation starts a 30-day trial and creates the owner", async () => {
  const now = Date.UTC(2026, 10, 2);
  const store = createStore();
  const result = await createCompanyOnboardingService(store, () => now).create({
    ownerUserId: "user-1",
    name: "Kampala Traders",
    industry: "Retail",
    sizeBand: "10-50",
  });

  assert.equal(result.companyId, "company-1");
  assert.equal(result.trialEndsAt.getTime(), now + 30 * 24 * 60 * 60 * 1000);
  assert.deepEqual(store.calls, [
    "company.create",
    "membership.create",
    "employee.create",
    "activityLog.create",
  ]);
});

test("company creation rejects missing owner or company name", async () => {
  const store = createStore();
  const service = createCompanyOnboardingService(store);

  await assert.rejects(
    () => service.create({ ownerUserId: "", name: "Company" }),
    /ownerUserId is required/,
  );
  await assert.rejects(
    () => service.create({ ownerUserId: "user-1", name: " " }),
    /name is required/,
  );
});
