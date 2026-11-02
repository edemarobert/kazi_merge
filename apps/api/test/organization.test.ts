import assert from "node:assert/strict";
import { test } from "node:test";
import { changeManager, listOrganization } from "../src/people/organization.js";

test("organization listing requests company-scoped department relations", async () => {
  let received: unknown;
  const departments: never[] = [];
  const result = await listOrganization({
    department: {
      async findMany(args) {
        received = args;
        return departments;
      },
    },
    employee: {
      async findFirst() {
        return null;
      },
      async update() {
        return { id: "employee-1", managerId: null };
      },
    },
  });

  assert.deepEqual(result, departments);
  assert.deepEqual(received, {
    include: {
      head: {
        include: {
          membership: { include: { user: { select: { id: true, name: true } } } },
        },
      },
      teams: {
        include: {
          lead: {
            include: {
              membership: { include: { user: { select: { id: true, name: true } } } },
            },
          },
          members: {
            include: {
              employee: {
                include: {
                  membership: {
                    include: { user: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
});

test("changing a manager rejects self-reporting", async () => {
  await assert.rejects(
    () =>
      changeManager(
        {
          department: {
            async findMany() {
              return [];
            },
          },
          employee: {
            async findFirst() {
              return { id: "employee-1" };
            },
            async update() {
              return { id: "employee-1", managerId: "employee-1" };
            },
          },
        },
        "employee-1",
        "employee-1",
      ),
    /cannot report to themselves/,
  );
});
