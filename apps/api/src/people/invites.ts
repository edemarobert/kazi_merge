import { createHash, randomBytes } from "node:crypto";
import { MembershipRole, MembershipStatus } from "@prisma/client";

const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export type InviteStore = {
  user: {
    findFirst(args: {
      where: { OR: Array<{ email?: string; phoneE164?: string }> };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: { email?: string; phoneE164?: string; name: string };
    }): Promise<{ id: string }>;
  };
  invite: {
    create(args: {
      data: {
        companyId: string;
        inviterUserId: string;
        inviteeUserId: string;
        role: MembershipRole;
        tokenHash: string;
        expiresAt: Date;
      };
    }): Promise<{ id: string; expiresAt: Date }>;
    findUnique(args: { where: { tokenHash: string } }): Promise<{
      id: string;
      companyId: string;
      inviteeUserId: string;
      role: MembershipRole;
      expiresAt: Date;
      acceptedAt: Date | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: { acceptedAt: Date };
    }): Promise<{ id: string }>;
  };
  membership: {
    update(args: {
      where: { companyId_userId: { companyId: string; userId: string } };
      data: { role: MembershipRole; status: MembershipStatus };
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

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeContact(input: { email?: string; phoneE164?: string }) {
  const email = input.email?.trim().toLowerCase();
  const phoneE164 = input.phoneE164?.trim();
  if ((!email && !phoneE164) || (email && phoneE164)) {
    throw new Error("Provide exactly one email or phone number.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email address is required.");
  }
  if (phoneE164 && !/^\+[1-9]\d{7,14}$/.test(phoneE164)) {
    throw new Error("Phone number must be in E.164 format.");
  }
  return { email, phoneE164 };
}

export function createInviteService(
  store: InviteStore,
  now: () => number = Date.now,
  transaction: <T>(callback: (store: InviteStore) => Promise<T>) => Promise<T> = (
    callback,
  ) => callback(store),
) {
  return {
    async create(input: {
      companyId: string;
      inviterUserId: string;
      email?: string;
      phoneE164?: string;
      role: MembershipRole;
    }) {
      if (
        input.role !== MembershipRole.manager &&
        input.role !== MembershipRole.employee
      ) {
        throw new Error("Only managers and employees can be invited.");
      }
      const contact = normalizeContact(input);
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now() + inviteLifetimeMs);
      return transaction(async (transactionStore) => {
        const invitee =
          (await transactionStore.user.findFirst({
            where: { OR: [{ email: contact.email }, { phoneE164: contact.phoneE164 }] },
          })) ??
          (await transactionStore.user.create({
            data: {
              ...contact,
              name: contact.email ?? contact.phoneE164 ?? "Invited person",
            },
          }));
        const invite = await transactionStore.invite.create({
          data: {
            companyId: input.companyId,
            inviterUserId: input.inviterUserId,
            inviteeUserId: invitee.id,
            role: input.role,
            tokenHash: hash(token),
            expiresAt,
          },
        });
        await transactionStore.activityLog.create({
          data: {
            companyId: input.companyId,
            actorUserId: input.inviterUserId,
            action: "people.invited",
            entityType: "Invite",
            entityId: invite.id,
            metadata: { role: input.role, expiresAt: expiresAt.toISOString() },
          },
        });
        return { inviteId: invite.id, token, expiresAt };
      });
    },

    async accept(token: string, userId: string) {
      const invite = await store.invite.findUnique({
        where: { tokenHash: hash(token) },
      });
      if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= now()) {
        throw new Error("The invitation is invalid or expired.");
      }
      if (invite.inviteeUserId !== userId) {
        throw new Error("The invitation does not belong to this identity.");
      }
      return transaction(async (transactionStore) => {
        const membership = await transactionStore.membership.update({
          where: {
            companyId_userId: {
              companyId: invite.companyId,
              userId,
            },
          },
          data: { role: invite.role, status: MembershipStatus.active },
        });
        await transactionStore.invite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(now()) },
        });
        await transactionStore.activityLog.create({
          data: {
            companyId: invite.companyId,
            actorUserId: userId,
            action: "people.invite.accepted",
            entityType: "Membership",
            entityId: membership.id,
            metadata: { inviteId: invite.id },
          },
        });
        return { membershipId: membership.id, companyId: invite.companyId };
      });
    },
  };
}
