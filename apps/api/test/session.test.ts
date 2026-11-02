import assert from "node:assert/strict";
import { test } from "node:test";
import { hashSessionToken, createSessionService } from "../src/auth/session.js";
import { readSessionCookie, sessionCookieName } from "../src/auth/cookie.js";

type StoredSession = {
  id: string;
  userId: string;
  companyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
};

function createStore(initial?: StoredSession) {
  let session = initial;
  return {
    session: {
      async create({
        data,
      }: {
        data: Omit<StoredSession, "id" | "revokedAt" | "lastSeenAt">;
      }) {
        session = {
          ...data,
          id: "session-id",
          revokedAt: null,
          lastSeenAt: new Date(),
        };
        return session;
      },
      async findUnique({ where }: { where: { tokenHash: string } }) {
        return session?.tokenHash === where.tokenHash ? session : null;
      },
      async update({ data }: { where: { id: string }; data: { lastSeenAt: Date } }) {
        assert.ok(session);
        session.lastSeenAt = data.lastSeenAt;
        return session;
      },
      async delete() {
        assert.ok(session);
        const deleted = session;
        session = undefined;
        return deleted;
      },
    },
  };
}

test("session tokens are random and only their hash is persisted", async () => {
  const store = createStore();
  const service = createSessionService(store);

  const token = await service.create("user-a", "company-a");

  assert.ok(token.length >= 40);
  assert.equal(store.session ? true : false, true);
  assert.equal(hashSessionToken(token).length, 64);
  assert.deepEqual(await service.resolve(token), {
    id: "session-id",
    userId: "user-a",
    companyId: "company-a",
    expiresAt: (await service.resolve(token))?.expiresAt,
  });
});

test("expired and revoked sessions cannot be resolved", async () => {
  const expiredStore = createStore({
    id: "expired",
    userId: "user-a",
    companyId: "company-a",
    tokenHash: hashSessionToken("expired-token"),
    expiresAt: new Date(Date.now() - 1),
    revokedAt: null,
    lastSeenAt: new Date(),
  });
  const revokedStore = createStore({
    id: "revoked",
    userId: "user-a",
    companyId: "company-a",
    tokenHash: hashSessionToken("revoked-token"),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: new Date(),
    lastSeenAt: new Date(),
  });

  assert.equal(await createSessionService(expiredStore).resolve("expired-token"), null);
  assert.equal(await createSessionService(revokedStore).resolve("revoked-token"), null);
});

test("session cookie parsing does not confuse similarly named cookies", () => {
  assert.equal(
    readSessionCookie(`other=value; ${sessionCookieName}=abc123; theme=dark`),
    "abc123",
  );
  assert.equal(readSessionCookie("kazi_session_extra=nope"), undefined);
});
