import { createHash, randomInt, randomBytes } from "node:crypto";

const otpLifetimeMs = 5 * 60 * 1000;
const maxAttempts = 5;
const requestCooldownMs = 60 * 1000;

export interface OtpSender {
  send(to: string, code: string): Promise<void>;
}

type OtpChallenge = {
  phoneE164: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
  requestedAt: number;
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizePhone(phone: string): string {
  const normalized = phone.trim().replace(/[()\s-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Phone number must be in E.164 format.");
  }
  return normalized;
}

export function createOtpService(sender: OtpSender, now: () => number = Date.now) {
  const challenges = new Map<string, OtpChallenge>();

  return {
    async request(phone: string): Promise<void> {
      const phoneE164 = normalizePhone(phone);
      const existing = challenges.get(phoneE164);
      if (existing && now() - existing.requestedAt < requestCooldownMs) {
        throw new Error("A verification code was recently requested.");
      }

      const code = randomInt(100000, 1000000).toString();
      challenges.set(phoneE164, {
        phoneE164,
        codeHash: hash(code),
        expiresAt: now() + otpLifetimeMs,
        attempts: 0,
        used: false,
        requestedAt: now(),
      });
      await sender.send(phoneE164, code);
    },

    verify(phone: string, code: string): boolean {
      const phoneE164 = normalizePhone(phone);
      const challenge = challenges.get(phoneE164);
      if (
        !challenge ||
        challenge.used ||
        challenge.expiresAt <= now() ||
        challenge.attempts >= maxAttempts
      ) {
        return false;
      }

      challenge.attempts += 1;
      if (!/^\d{6}$/.test(code) || hash(code) !== challenge.codeHash) {
        return false;
      }

      challenge.used = true;
      challenges.delete(phoneE164);
      return true;
    },

    clear(phone: string): void {
      challenges.delete(normalizePhone(phone));
    },
  };
}

export function generateOpaqueChallengeId(): string {
  return randomBytes(16).toString("base64url");
}
