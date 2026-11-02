import { Prisma } from "@prisma/client";

export const organizationInclude = {
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
              membership: { include: { user: { select: { id: true, name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  },
} satisfies Prisma.DepartmentInclude;

export type OrganizationDepartment = Prisma.DepartmentGetPayload<{
  include: typeof organizationInclude;
}>;

type OrganizationStore = {
  department: {
    findMany(args: unknown): Promise<OrganizationDepartment[]>;
  };
  employee: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    update(args: unknown): Promise<{ id: string; managerId: string | null }>;
  };
};

export async function listOrganization(store: OrganizationStore) {
  return store.department.findMany({
    include: organizationInclude,
    orderBy: { name: "asc" },
  });
}

export async function changeManager(
  store: OrganizationStore,
  employeeId: string,
  managerId: string | null,
) {
  const employee = await store.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) {
    throw new Error("Employee not found.");
  }
  if (managerId === employeeId) {
    throw new Error("An employee cannot report to themselves.");
  }
  if (managerId) {
    const manager = await store.employee.findFirst({
      where: { id: managerId, deletedAt: null, status: "active" },
      select: { id: true },
    });
    if (!manager) {
      throw new Error("Reporting manager not found.");
    }
  }
  return store.employee.update({
    where: { id: employeeId },
    data: { managerId },
    select: { id: true, managerId: true },
  });
}
