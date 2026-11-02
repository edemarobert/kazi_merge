import { MembershipRole, MembershipStatus } from "@prisma/client";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";

export type PolicyAction =
  | "company.settings.edit"
  | "people.invite.manager"
  | "people.invite.employee"
  | "people.profile.view.all"
  | "people.profile.view"
  | "people.profile.edit"
  | "people.profile.remove"
  | "people.role.change"
  | "tasks.create"
  | "tasks.assign"
  | "tasks.view"
  | "tasks.update"
  | "dashboard.view"
  | "activity.view"
  | "integrations.connect";

export type PolicyContext = {
  actorUserId?: string;
  targetEmployeeId?: string;
  targetTaskId?: string;
  targetUserId?: string;
  targetTeamId?: string;
};

type PolicyFacts = {
  role: MembershipRole;
  employeeId: string;
  isOwnTeam: boolean;
  isOwnResource: boolean;
  isOwnAccount: boolean;
};

export class PolicyDeniedError extends Error {
  constructor(
    public readonly action: PolicyAction,
    message = `The ${action.replaceAll(".", " ")} action is not permitted.`,
  ) {
    super(message);
    this.name = "PolicyDeniedError";
  }
}

async function loadFacts(context: PolicyContext): Promise<PolicyFacts> {
  const activeCompanyId = requireCompanyId();
  const actorUserId = context.actorUserId ?? getActorUserId();
  if (!actorUserId) {
    throw new PolicyDeniedError("activity.view", "An authenticated actor is required.");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      companyId_userId: {
        companyId: activeCompanyId,
        userId: actorUserId,
      },
    },
    include: { employee: true },
  });
  if (
    !membership ||
    membership.status !== MembershipStatus.active ||
    !membership.employee
  ) {
    throw new PolicyDeniedError(
      "activity.view",
      "The actor is not an active company member.",
    );
  }

  const targetEmployeeId = context.targetEmployeeId;
  const targetEmployeeTeams = targetEmployeeId
    ? await prisma.teamMember.findMany({
        where: { employeeId: targetEmployeeId },
        select: { teamId: true },
      })
    : [];
  const targetTask = context.targetTaskId
    ? await prisma.task.findFirst({
        where: { id: context.targetTaskId },
        select: { assigneeEmployeeId: true, teamId: true },
      })
    : undefined;
  const targetTeamId = context.targetTeamId ?? targetTask?.teamId;
  const isOwnTeam = targetTeamId
    ? Boolean(
        await prisma.teamMember.findFirst({
          where: { teamId: targetTeamId, employeeId: membership.employee.id },
        }),
      )
    : targetEmployeeTeams.length > 0
      ? Boolean(
          await prisma.teamMember.findFirst({
            where: {
              employeeId: membership.employee.id,
              teamId: { in: targetEmployeeTeams.map((team) => team.teamId) },
            },
          }),
        )
      : false;
  const resourceEmployeeId = targetEmployeeId ?? targetTask?.assigneeEmployeeId;
  return {
    role: membership.role,
    employeeId: membership.employee.id,
    isOwnTeam,
    isOwnResource: resourceEmployeeId === membership.employee.id,
    isOwnAccount: context.targetUserId === actorUserId || !context.targetUserId,
  };
}

export async function can(
  action: PolicyAction,
  context: PolicyContext = {},
): Promise<boolean> {
  const facts = await loadFacts(context);
  if (action === "integrations.connect") {
    return facts.isOwnAccount;
  }
  if (facts.role === MembershipRole.owner) {
    return true;
  }
  if (facts.role === MembershipRole.employee) {
    return (
      (action === "people.profile.edit" && facts.isOwnResource) ||
      (action === "people.profile.view" && (facts.isOwnResource || facts.isOwnTeam)) ||
      (action === "tasks.create" && facts.isOwnResource) ||
      (action === "tasks.view" && (facts.isOwnResource || facts.isOwnTeam)) ||
      (action === "tasks.update" && facts.isOwnResource) ||
      (action === "activity.view" && facts.isOwnResource)
    );
  }
  if (facts.role === MembershipRole.manager) {
    return (
      (action === "people.invite.employee" && facts.isOwnTeam) ||
      (action === "people.profile.view.all" && facts.isOwnTeam) ||
      (action === "people.profile.view" && facts.isOwnTeam) ||
      (action === "people.profile.edit" && facts.isOwnTeam) ||
      (action === "people.profile.remove" && facts.isOwnTeam) ||
      (action === "tasks.assign" && facts.isOwnTeam) ||
      (action === "tasks.view" && facts.isOwnTeam) ||
      (action === "tasks.update" && facts.isOwnTeam) ||
      action === "tasks.create" ||
      action === "dashboard.view" ||
      (action === "activity.view" && facts.isOwnTeam)
    );
  }
  return false;
}

export async function requirePolicy(
  action: PolicyAction,
  context: PolicyContext = {},
): Promise<void> {
  if (!(await can(action, context))) {
    throw new PolicyDeniedError(action);
  }
}
