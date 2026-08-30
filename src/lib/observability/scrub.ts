/**
 * PII / secret scrubbing for error-monitoring events.
 *
 * Nothing here is Sentry-specific: `scrubEvent` walks a plain object and
 * redacts any value whose key matches the denylist, plus any string value that
 * looks like a bearer token / API key. It is applied as Sentry's `beforeSend`
 * hook but is independently unit-tested.
 *
 * We NEVER want the following to leave the process:
 *   - shipment address snapshots            (`address_snapshot`)
 *   - raw form answers                      (`answers`, `creator_answers`, `field_snapshot`)
 *   - secure-link tokens or their hashes    (`token`, `token_hash`)
 *   - auth material                         (`password`, `authorization`, `cookie`, `api_key`, `secret`)
 *   - direct personal identifiers           (`cpf`, `email`, `phone`, `phone_e164`, `postal_code`)
 */

const REDACTED = "[redacted]";

/** Key names (case-insensitive, substring match) whose values are always removed. */
const DENY_KEY_PATTERNS = [
  "address_snapshot",
  "answers",
  "field_snapshot",
  "token",
  "password",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "service_role",
  "anon_key",
  "access_key",
  "cpf",
  "email",
  "phone",
  "postal_code",
  "recipient_name",
  "street",
];

/** Value patterns that look like credentials regardless of their key. */
const SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bsb_(secret|publishable)_[A-Za-z0-9_-]{8,}\b/,
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/i,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /\b[a-f0-9]{64}\b/, // sha256 hex (our token hashes)
];

function keyIsDenied(key: string): boolean {
  const k = key.toLowerCase();
  return DENY_KEY_PATTERNS.some((p) => k.includes(p));
}

function redactString(value: string): string {
  let out = value;
  for (const re of SECRET_VALUE_PATTERNS) out = out.replace(re, REDACTED);
  return out;
}

/**
 * Recursively redact. Returns a new value; does not mutate the input.
 * `depth` guards against pathological nesting / cycles.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = keyIsDenied(k) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Sentry `beforeSend`-shaped scrubber. Typed loosely so this module has no
 * dependency on the Sentry SDK.
 */
export function scrubEvent<T extends Record<string, unknown>>(event: T): T {
  const e = event as Record<string, unknown>;

  // Drop headers/cookies wholesale; redact query + body.
  if (e.request && typeof e.request === "object") {
    const req = { ...(e.request as Record<string, unknown>) };
    delete req.cookies;
    delete req.headers;
    if (typeof req.query_string === "string") {
      req.query_string = redactString(req.query_string);
    }
    if (req.data !== undefined) req.data = scrubValue(req.data);
    e.request = req;
  }

  for (const field of ["extra", "contexts", "tags"] as const) {
    if (e[field] !== undefined) e[field] = scrubValue(e[field]);
  }

  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = (e.breadcrumbs as unknown[]).map((b) => scrubValue(b));
  }

  // Never attribute an event to a real person.
  if (e.user && typeof e.user === "object") {
    e.user = { id: (e.user as { id?: unknown }).id ?? undefined };
  }

  return e as T;
}
