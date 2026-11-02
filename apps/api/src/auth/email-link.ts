import { createHash, randomBytes } from "node:crypto";

const linkLifetimeMs = 15 * 60 * 1000;

export interface EmailLinkSender {
  send(to: string, link: string): Promise<void>;
}

type EmailChallenge = {
  email: string;
  tokenHash: string;
  expiresAt: number;
  used: boolean;
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("A valid email address is required.");
  }
  return normalized;
}

export function createEmailLinkService(
  sender: EmailLinkSender,
  linkBaseUrl: string,
  now: () => number = Date.now,
) {
  const challenges = new Map<string, EmailChallenge>();

  return {
    async request(email: string): Promise<void> {
      const normalizedEmail = normalizeEmail(email);
      const token = randomBytes(32).toString("base64url");
      challenges.set(normalizedEmail, {
        email: normalizedEmail,
        tokenHash: hash(token),
        expiresAt: now() + linkLifetimeMs,
        used: false,
      });
      const link = new URL(linkBaseUrl);
      link.searchParams.set("token", token);
      link.searchParams.set("email", normalizedEmail);
      await sender.send(normalizedEmail, link.toString());
    },

    consume(email: string, token: string): boolean {
      const normalizedEmail = normalizeEmail(email);
      const challenge = challenges.get(normalizedEmail);
      if (!challenge || challenge.used || challenge.expiresAt <= now() || !token) {
        return false;
      }
      if (hash(token) !== challenge.tokenHash) {
        return false;
      }
      challenge.used = true;
      challenges.delete(normalizedEmail);
      return true;
    },
  };
}
