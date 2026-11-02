import { MembershipRole } from "@prisma/client";

export type PolicyAction =
  | "company.settings.edit"
  | "people.invite.manager"
  | "people.invite.employee"
  | "people.profile.view.all"
  | "people.profile.edit"
  | "tasks.create"
  | "tasks.assign"
  | "tasks.view"
  | "tasks.update"
  | "dashboard.view"
  | "activity.view"
  | "integrations.connect";

export type PolicyContext = {
  role: MembershipRole;
  isOwnTeam?: boolean;
  isOwnResource?: boolean;
  isOwnAccount?: boolean;
};

export class PolicyDeniedError extends Error {
  constructor(action: PolicyAction) {
    super(`The ${contextLabel(action)} action is not permitted.`);
    this.name = "PolicyDeniedError";
  }
}

function contextLabel(action: PolicyAction): string {
  return action.replaceAll(".", " ");
}

export function can(action: PolicyAction, context: PolicyContext): boolean {
  const {
    role,
    isOwnTeam = false,
    isOwnResource = false,
    isOwnAccount = false,
  } = context;

  if (role === MembershipRole.owner) {
    return true;
  }

  if (action === "integrations.connect") {
    return isOwnAccount;
  }

  if (role === MembershipRole.employee) {
    return (
      (action === "people.profile.edit" && isOwnResource) ||
      (action === "tasks.create" && isOwnResource) ||
      (action === "tasks.view" && (isOwnResource || isOwnTeam)) ||
      (action === "tasks.update" && isOwnResource) ||
      (action === "activity.view" && isOwnResource)
    );
  }

  if (role === MembershipRole.manager) {
    return (
      (action === "people.invite.employee" && isOwnTeam) ||
      (action === "people.profile.view.all" && isOwnTeam) ||
      (action === "people.profile.edit" && isOwnTeam) ||
      action === "tasks.create" ||
      (action === "tasks.assign" && isOwnTeam) ||
      (action === "tasks.view" && isOwnTeam) ||
      (action === "tasks.update" && isOwnTeam) ||
      action === "dashboard.view" ||
      (action === "activity.view" && isOwnTeam)
    );
  }

  return false;
}

export function requirePolicy(action: PolicyAction, context: PolicyContext): void {
  if (!can(action, context)) {
    throw new PolicyDeniedError(action);
  }
}
