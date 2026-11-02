import { createHash, randomBytes } from "node:crypto";

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

type SessionRecord = {
  id: string;
  userId: string;
  companyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

type SessionStore = {
  session: {
    create(args: {
      data: {
        userId: string;
        companyId: string;
        tokenHash: string;
        expiresAt: Date;
      };
    }): Promise<SessionRecord>;
    findUnique(args: { where: { tokenHash: string } }): Promise<SessionRecord | null>;
    update(args: {
      where: { id: string };
      data: { lastSeenAt: Date };
    }): Promise<SessionRecord>;
    delete(args: { where: { id: string } }): Promise<SessionRecord>;
  };
};

export type AuthenticatedSession = {
  id: string;
  userId: string;
  companyId: string;
  expiresAt: Date;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionService(store: SessionStore) {
  return {
    async create(userId: string, companyId: string): Promise<string> {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + sessionLifetimeMs);
      await store.session.create({
        data: {
          userId,
          companyId,
          tokenHash: hashSessionToken(token),
          expiresAt,
        },
      });
      return token;
    },

    async resolve(token: string): Promise<AuthenticatedSession | null> {
      if (!token.trim()) {
        return null;
      }

      const session = await store.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
      });
      if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      await store.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
      return {
        id: session.id,
        userId: session.userId,
        companyId: session.companyId,
        expiresAt: session.expiresAt,
      };
    },

    async revoke(token: string): Promise<void> {
      const session = await store.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
      });
      if (session) {
        await store.session.delete({ where: { id: session.id } });
      }
    },
  };
}
