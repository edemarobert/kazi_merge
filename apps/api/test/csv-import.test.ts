import assert from "node:assert/strict";
import { test } from "node:test";
import { importEmployeeRows, previewEmployeeCsv } from "../src/people/csv-import.js";

test("CSV preview keeps valid rows and reports invalid rows", () => {
  const result = previewEmployeeCsv(
    "name,email,phoneE164,jobTitle,startDate\n" +
      "Brian,brian@example.com,+256700000001,Operator,2026-01-02\n" +
      "Missing,,+256700000002,Operator,2026-01-02\n" +
      "Bad,bad-email,,Operator,2026-01-02",
  );
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.errors, [{ rowNumber: 4, message: "Email is invalid" }]);
});

test("CSV import continues after a row fails", async () => {
  let created = 0;
  const result = await importEmployeeRows(
    {
      user: {
        async findFirst() {
          return null;
        },
        async create() {
          return { id: `user-${++created}` };
        },
      },
      membership: {
        async create() {
          if (created === 2) throw new Error("duplicate membership");
          return { id: "membership-1" };
        },
      },
      employee: {
        async create() {
          return { id: "employee-1" };
        },
      },
    },
    "company-1",
    [
      { rowNumber: 2, name: "One", email: "one@example.com" },
      { rowNumber: 3, name: "Two", email: "two@example.com" },
    ],
  );
  assert.deepEqual(result.imported, [{ rowNumber: 2, employeeId: "employee-1" }]);
  assert.deepEqual(result.errors, [{ rowNumber: 3, message: "duplicate membership" }]);
});
