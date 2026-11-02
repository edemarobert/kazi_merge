import { EmployeeStatus, Prisma } from "@prisma/client";
import { can } from "../policy/policy.js";

export const employeeProfileInclude = {
  membership: {
    include: {
      user: { select: { id: true, name: true, email: true, phoneE164: true } },
    },
  },
  department: { select: { id: true, name: true } },
  manager: {
    include: {
      membership: { include: { user: { select: { id: true, name: true } } } },
    },
  },
  teamMembers: { include: { team: { select: { id: true, name: true } } } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeProfile = Prisma.EmployeeGetPayload<{
  include: typeof employeeProfileInclude;
}>;

export type EmployeeDirectoryFilters = {
  search?: string;
  teamId?: string;
  status?: EmployeeStatus;
};

type EmployeeQuery = {
  findMany: (args: unknown) => Promise<EmployeeProfile[]>;
  findFirst: (args: unknown) => Promise<EmployeeProfile | null>;
};

export async function listVisibleEmployees(
  employeeQuery: EmployeeQuery,
  filters: EmployeeDirectoryFilters = {},
): Promise<EmployeeProfile[]> {
  const where: Prisma.EmployeeWhereInput = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            {
              membership: {
                user: { name: { contains: filters.search, mode: "insensitive" } },
              },
            },
            { jobTitle: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.teamId ? { teamMembers: { some: { teamId: filters.teamId } } } : {}),
  };
  const employees = await employeeQuery.findMany({
    where,
    include: employeeProfileInclude,
    orderBy: { membership: { user: { name: "asc" } } },
  });
  const visible: EmployeeProfile[] = [];
  for (const employee of employees) {
    if (await can("people.profile.view", { targetEmployeeId: employee.id })) {
      visible.push(employee);
    }
  }
  return visible;
}

export async function getVisibleEmployee(
  employeeQuery: EmployeeQuery,
  employeeId: string,
): Promise<EmployeeProfile | null> {
  const employee = await employeeQuery.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: employeeProfileInclude,
  });
  if (
    !employee ||
    !(await can("people.profile.view", { targetEmployeeId: employee.id }))
  ) {
    return null;
  }
  return employee;
}
