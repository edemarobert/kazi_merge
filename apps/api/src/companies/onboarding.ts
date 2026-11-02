import { MembershipRole, MembershipStatus } from "@prisma/client";
import { companyId, runWithCompanyContextAsync } from "../context/company-context.js";

const trialLengthMs = 30 * 24 * 60 * 60 * 1000;

type CompanyRecord = {
  id: string;
};

type OnboardingTransaction = {
  company: {
    create(args: {
      data: {
        name: string;
        industry?: string;
        sizeBand?: string;
        plan: "trial";
        trialEndsAt: Date;
      };
    }): Promise<CompanyRecord>;
  };
  membership: {
    create(args: {
      data: {
        companyId: string;
        userId: string;
        role: MembershipRole;
        status: MembershipStatus;
      };
    }): Promise<{ id: string }>;
  };
  employee: {
    create(args: {
      data: {
        companyId: string;
        membershipId: string;
        jobTitle: string;
      };
    }): Promise<{ id: string }>;
  };
  activityLog: {
    create(args: {
      data: {
        companyId: string;
        actorUserId: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Record<string, unknown>;
      };
    }): Promise<{ id: string }>;
  };
};

type OnboardingStore = OnboardingTransaction & {
  $transaction<T>(
    callback: (transaction: OnboardingTransaction) => Promise<T>,
  ): Promise<T>;
};

export type CompanyCreationInput = {
  ownerUserId: string;
  name: string;
  industry?: string;
  sizeBand?: string;
};

export type CreatedCompany = {
  companyId: string;
  membershipId: string;
  employeeId: string;
  trialEndsAt: Date;
};

function requiredText(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

export function createCompanyOnboardingService(
  store: OnboardingStore,
  now: () => number = Date.now,
) {
  return {
    async create(input: CompanyCreationInput): Promise<CreatedCompany> {
      const ownerUserId = requiredText(input.ownerUserId, "ownerUserId");
      const name = requiredText(input.name, "name");
      const createdAt = new Date(now());
      const trialEndsAt = new Date(createdAt.getTime() + trialLengthMs);

      return store.$transaction(async (transaction) => {
        const company = await transaction.company.create({
          data: {
            name,
            industry: input.industry?.trim() || undefined,
            sizeBand: input.sizeBand?.trim() || undefined,
            plan: "trial",
            trialEndsAt,
          },
        });

        return runWithCompanyContextAsync(
          companyId(company.id),
          async () => {
            const membership = await transaction.membership.create({
              data: {
                companyId: company.id,
                userId: ownerUserId,
                role: MembershipRole.owner,
                status: MembershipStatus.active,
              },
            });
            const employee = await transaction.employee.create({
              data: {
                companyId: company.id,
                membershipId: membership.id,
                jobTitle: "Owner",
              },
            });
            await transaction.activityLog.create({
              data: {
                companyId: company.id,
                actorUserId: ownerUserId,
                action: "company.created",
                entityType: "Company",
                entityId: company.id,
                metadata: { plan: "trial", trialEndsAt: trialEndsAt.toISOString() },
              },
            });
            return {
              companyId: company.id,
              membershipId: membership.id,
              employeeId: employee.id,
              trialEndsAt,
            };
          },
          ownerUserId,
        );
      });
    },
  };
}

export const trialDurationDays = 30;
