import assert from "node:assert/strict";
import { test } from "node:test";
import {
  companyId,
  getCompanyId,
  requireCompanyId,
  runWithCompanyContext,
  runWithCompanyContextAsync,
} from "../src/context/company-context.js";
import {
  assertCompanyScope,
  CompanyScopeViolation,
  scopedData,
  scopedWhere,
} from "../src/db/company-scope.js";

const companyA = companyId("company-a");
const companyB = companyId("company-b");

test("business queries require an active company context", () => {
  assert.equal(getCompanyId(), undefined);
  assert.throws(() => requireCompanyId(), /Company context is required/);
  assert.throws(() => scopedWhere({ status: "todo" }), /Company context is required/);
});

test("scopedWhere adds the active company to every query", () => {
  const where = runWithCompanyContext(companyA, () => scopedWhere({ status: "todo" }));

  assert.deepEqual(where, { status: "todo", companyId: companyA });
});

test("scopedData adds the active company to writes", () => {
  const data = runWithCompanyContext(companyA, () =>
    scopedData({ title: "Prepare report" }),
  );

  assert.deepEqual(data, { title: "Prepare report", companyId: companyA });
});

test("a query cannot override the active company", () => {
  assert.throws(
    () => runWithCompanyContext(companyA, () => scopedWhere({ companyId: companyB })),
    CompanyScopeViolation,
  );
  assert.throws(
    () => runWithCompanyContext(companyA, () => scopedData({ companyId: companyB })),
    CompanyScopeViolation,
  );
  assert.throws(
    () => runWithCompanyContext(companyA, () => assertCompanyScope(companyB)),
    CompanyScopeViolation,
  );
});

test("company context remains isolated across asynchronous work", async () => {
  const [a, b] = await Promise.all([
    runWithCompanyContextAsync(companyA, async () => {
      await Promise.resolve();
      return requireCompanyId();
    }),
    runWithCompanyContextAsync(companyB, async () => {
      await Promise.resolve();
      return requireCompanyId();
    }),
  ]);

  assert.equal(a, companyA);
  assert.equal(b, companyB);
  assert.equal(getCompanyId(), undefined);
});
