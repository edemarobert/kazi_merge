import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

function encryptionKey(): Buffer {
  const configured = process.env.INTEGRATION_TOKEN_KEY;
  if (!configured) {
    throw new Error("INTEGRATION_TOKEN_KEY is required to encrypt integration tokens.");
  }
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATION_TOKEN_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptIntegrationToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptIntegrationToken(payload: string): string {
  const [ivText, tagText, ciphertextText] = payload.split(".");
  if (!ivText || !tagText || !ciphertextText) {
    throw new Error("Encrypted integration token is malformed.");
  }
  const decipher = createDecipheriv(
    algorithm,
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
