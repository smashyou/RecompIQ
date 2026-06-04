import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// App-level AES-256-GCM for provider API keys stored in ai_provider_secrets.
// Master key is AI_SECRETS_KEY (base64 of 32 random bytes). If it's unset the
// feature is disabled (admin sees a notice) and the gateway falls back to env
// vars — nothing breaks, keys just can't be managed in-app on that deploy.

function masterKey(): Buffer | null {
  const b64 = process.env.AI_SECRETS_KEY;
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function secretsEnabled(): boolean {
  return masterKey() !== null;
}

export function encryptSecret(plain: string): string {
  const key = masterKey();
  if (!key) throw new Error("AI_SECRETS_KEY is not configured (or not 32 bytes base64).");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(blob: string): string | null {
  const key = masterKey();
  if (!key) return null;
  const [ivB, tagB, dataB] = blob.split(":");
  if (!ivB || !tagB || !dataB) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function last4(key: string): string {
  return key.length <= 4 ? key : key.slice(-4);
}
