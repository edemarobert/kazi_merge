import { EmployeeStatus, Prisma } from "@prisma/client";
import { getActorUserId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";
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

function sanitizeTeammateProfile(employee: EmployeeProfile): EmployeeProfile {
  return {
    ...employee,
    membership: {
      ...employee.membership,
      user: {
        ...employee.membership.user,
        email: null,
        phoneE164: null,
      },
    },
    manager: null,
  };
}

async function shouldSanitizeTeammates(): Promise<boolean> {
  const actorUserId = getActorUserId();
  if (!actorUserId) return false;
  const membership = await prisma.membership.findFirst({
    where: { userId: actorUserId, status: "active" },
    select: { role: true },
  });
  return membership?.role === "employee";
}

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
  const sanitize = await shouldSanitizeTeammates();
  const visible: EmployeeProfile[] = [];
  for (const employee of employees) {
    if (await can("people.profile.view", { targetEmployeeId: employee.id })) {
      visible.push(sanitize ? sanitizeTeammateProfile(employee) : employee);
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
  return (await shouldSanitizeTeammates())
    ? sanitizeTeammateProfile(employee)
    : employee;
}
