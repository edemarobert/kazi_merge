import assert from "node:assert/strict";
import { MembershipRole } from "@prisma/client";
import { test } from "node:test";
import { createInviteService } from "../src/people/invites.js";

function store() {
  type Invite = {
    id: string;
    companyId: string;
    inviteeUserId: string;
    role: MembershipRole;
    tokenHash: string;
    expiresAt: Date;
    acceptedAt: Date | null;
  };
  let invite: Invite | undefined;
  return {
    user: {
      async findFirst() {
        return null;
      },
      async create() {
        return { id: "invitee-1" };
      },
    },
    invite: {
      async create({ data }: { data: Omit<Invite, "id" | "acceptedAt"> }) {
        invite = { id: "invite-1", ...data, acceptedAt: null };
        return invite;
      },
      async findUnique() {
        return invite ?? null;
      },
      async update({ data }: { data: { acceptedAt: Date } }) {
        assert.ok(invite);
        invite.acceptedAt = data.acceptedAt;
        return invite;
      },
    },
    membership: {
      async update({ data }: { data: { role: MembershipRole; status: string } }) {
        assert.equal(data.status, "active");
        assert.equal(data.role, MembershipRole.employee);
        return { id: "membership-1" };
      },
    },
    activityLog: {
      async create() {
        return { id: "activity-1" };
      },
    },
  };
}

test("invite tokens expire and acceptance activates the invited membership", async () => {
  let now = 1_000;
  const service = createInviteService(store(), () => now);
  const created = await service.create({
    companyId: "company-a",
    inviterUserId: "owner-a",
    email: "worker@example.com",
    role: MembershipRole.employee,
  });
  const accepted = await service.accept(created.token, "invitee-1");
  assert.equal(accepted.membershipId, "membership-1");

  await assert.rejects(
    () => service.accept(created.token, "invitee-1"),
    /invalid or expired/,
  );
  now += 7 * 24 * 60 * 60 * 1000 + 1;
});

test("invite creation requires exactly one contact and rejects owner invites", async () => {
  const service = createInviteService(store());
  await assert.rejects(
    () =>
      service.create({
        companyId: "company-a",
        inviterUserId: "owner-a",
        email: "a@example.com",
        phoneE164: "+256700000000",
        role: MembershipRole.employee,
      }),
    /exactly one/,
  );
  await assert.rejects(
    () =>
      service.create({
        companyId: "company-a",
        inviterUserId: "owner-a",
        email: "a@example.com",
        role: MembershipRole.owner,
      }),
    /Only managers and employees/,
  );
});
