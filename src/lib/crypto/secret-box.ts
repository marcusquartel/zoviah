/**
 * Server-side encryption for third-party credentials (Shopify client secret,
 * access tokens) and the per-organization "ingest key".
 *
 * The database only ever stores ciphertext; the key (`SHOPIFY_ENC_KEY`, 32
 * random bytes, base64) lives only in the server env. SERVER ONLY — never
 * import from client code. Relative imports keep it loadable by the node test
 * runner.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.SHOPIFY_ENC_KEY;
  if (!raw) throw new Error("SHOPIFY_ENC_KEY não configurada no servidor.");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("SHOPIFY_ENC_KEY deve ter 32 bytes (base64).");
  return k;
}

export function isSecretBoxConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** AES-256-GCM → "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== VERSION || !iv || !tag || ct === undefined) throw new Error("Ciphertext inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * The organization's ingest key: HMAC(server key, org id), hex. Deterministic,
 * so it is never stored — the DB keeps only its SHA-256 and the webhook route
 * re-derives it to prove it holds the server key.
 */
export function ingestKey(organizationId: string): string {
  return createHmac("sha256", key()).update(`shopify-ingest:${organizationId}`).digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
