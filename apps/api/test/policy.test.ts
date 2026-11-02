import assert from "node:assert/strict";
import { test } from "node:test";
import { MembershipRole } from "@prisma/client";
import { can, PolicyDeniedError, requirePolicy } from "../src/policy/policy.js";

test("owners can perform every policy action", () => {
  const actions = [
    "company.settings.edit",
    "people.invite.manager",
    "people.invite.employee",
    "people.profile.view.all",
    "people.profile.edit",
    "tasks.create",
    "tasks.assign",
    "tasks.view",
    "tasks.update",
    "dashboard.view",
    "activity.view",
    "integrations.connect",
  ] as const;

  for (const action of actions) {
    assert.equal(can(action, { role: MembershipRole.owner }), true, action);
  }
});

test("managers are limited to their team except task creation and dashboard", () => {
  const ownTeam = { role: MembershipRole.manager, isOwnTeam: true };
  const outsideTeam = { role: MembershipRole.manager, isOwnTeam: false };

  assert.equal(can("tasks.create", outsideTeam), true);
  assert.equal(can("dashboard.view", outsideTeam), true);
  assert.equal(can("tasks.assign", ownTeam), true);
  assert.equal(can("tasks.assign", outsideTeam), false);
  assert.equal(can("people.invite.employee", ownTeam), true);
  assert.equal(can("people.invite.employee", outsideTeam), false);
  assert.equal(can("company.settings.edit", ownTeam), false);
});

test("employees can act only on their own work or team-visible tasks", () => {
  const ownTask = { role: MembershipRole.employee, isOwnResource: true };
  const teamTask = { role: MembershipRole.employee, isOwnTeam: true };
  const unrelated = { role: MembershipRole.employee };

  assert.equal(can("tasks.create", ownTask), true);
  assert.equal(can("tasks.create", unrelated), false);
  assert.equal(can("tasks.view", ownTask), true);
  assert.equal(can("tasks.view", teamTask), true);
  assert.equal(can("tasks.view", unrelated), false);
  assert.equal(can("tasks.update", ownTask), true);
  assert.equal(can("tasks.update", teamTask), false);
  assert.equal(can("dashboard.view", ownTask), false);
});

test("integration connections are limited to the member's own account", () => {
  assert.equal(
    can("integrations.connect", {
      role: MembershipRole.manager,
      isOwnAccount: true,
    }),
    true,
  );
  assert.equal(
    can("integrations.connect", {
      role: MembershipRole.manager,
      isOwnAccount: false,
    }),
    false,
  );
  assert.equal(
    can("integrations.connect", {
      role: MembershipRole.employee,
      isOwnAccount: true,
    }),
    true,
  );
});

test("requirePolicy throws a typed denial for forbidden actions", () => {
  assert.throws(
    () =>
      requirePolicy("company.settings.edit", {
        role: MembershipRole.employee,
      }),
    (error: unknown) => {
      assert.ok(error instanceof PolicyDeniedError);
      assert.match(error.message, /company settings edit/);
      return true;
    },
  );
});
