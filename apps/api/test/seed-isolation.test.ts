import assert from "node:assert/strict";
import { test } from "node:test";
import { demoCompanies } from "../src/seed/demo-data.js";
import {
  companyId,
  runWithCompanyContext,
  runWithCompanyContextAsync,
} from "../src/context/company-context.js";
import { CompanyScopeViolation, scopedWhere } from "../src/db/company-scope.js";
import { prisma } from "../src/db/prisma.js";

test("demo seed data contains two distinct companies", () => {
  assert.equal(demoCompanies.length, 2);
  assert.notEqual(demoCompanies[0].id, demoCompanies[1].id);
  assert.notEqual(demoCompanies[0].owner.email, demoCompanies[1].owner.email);
  assert.notEqual(demoCompanies[0].task.id, demoCompanies[1].task.id);
});

test("each seeded task belongs to its own company", () => {
  for (const company of demoCompanies) {
    const where = runWithCompanyContext(companyId(company.id), () =>
      scopedWhere({ id: company.task.id }),
    );
    assert.equal(where.companyId, company.id);
  }
});

test("a company cannot query the other seeded company's task", () => {
  const [first, second] = demoCompanies;
  assert.throws(
    () =>
      runWithCompanyContext(companyId(first.id), () =>
        scopedWhere({ id: second.task.id, companyId: second.id }),
      ),
    CompanyScopeViolation,
  );
});

test("seeded companies are isolated in PostgreSQL", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured");
    return;
  }

  const [first, second] = demoCompanies;
  try {
    await prisma.$connect();
    const firstView = await runWithCompanyContextAsync(
      companyId(first.id),
      async () => ({
        own: await prisma.task.findFirst({ where: { id: first.task.id } }),
        other: await prisma.task.findFirst({ where: { id: second.task.id } }),
      }),
    );
    const secondView = await runWithCompanyContextAsync(
      companyId(second.id),
      async () => ({
        own: await prisma.task.findFirst({ where: { id: second.task.id } }),
        other: await prisma.task.findFirst({ where: { id: first.task.id } }),
      }),
    );

    assert.equal(firstView.own?.id, first.task.id);
    assert.equal(firstView.other, null);
    assert.equal(secondView.own?.id, second.task.id);
    assert.equal(secondView.other, null);
  } finally {
    await prisma.$disconnect();
  }
});
