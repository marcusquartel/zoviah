/**
 * Central production-environment validation.
 *
 * One place that says what a production deploy needs and what each variable is
 * allowed to be. The runtime modules (`lib/app-url`, `lib/legal`,
 * `lib/supabase/env`, `lib/anthropic/*`) keep their own narrow accessors for
 * day-to-day use; this module is the single source of truth for the go-live
 * checklist and for `/api/health`'s config view.
 *
 * Pure: pass an explicit `env` map and `isProduction` flag. Nothing here reads
 * `process.env` implicitly except the zero-arg convenience wrapper at the end.
 *
 * NEVER logs or returns a secret value — only names and pass/fail.
 */

export type EnvSeverity = "ok" | "warn" | "error";

export interface EnvCheck {
  key: string;
  severity: EnvSeverity;
  /** True when this check must pass before pointing a paying customer here. */
  blocking: boolean;
  message: string;
}

export interface EnvReport {
  checks: EnvCheck[];
  /** No blocking error — safe to serve production traffic. */
  productionReady: boolean;
  errors: EnvCheck[];
  warnings: EnvCheck[];
}

type EnvMap = Record<string, string | undefined>;

function val(env: EnvMap, key: string): string {
  return (env[key] ?? "").trim();
}

function isHttpUrl(raw: string): { ok: boolean; url?: URL } {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
    return { ok: true, url: u };
  } catch {
    return { ok: false };
  }
}

function isLocalHost(u: URL): boolean {
  return (
    u.hostname === "localhost" ||
    u.hostname === "127.0.0.1" ||
    u.hostname === "0.0.0.0" ||
    u.hostname.endsWith(".local")
  );
}

/** Any `NEXT_PUBLIC_`-prefixed key that would be a secret if exposed. */
const FORBIDDEN_PUBLIC_SECRETS = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_ANTHROPIC_KEY",
];

export function checkProductionEnv(
  env: EnvMap,
  opts: { isProduction: boolean },
): EnvReport {
  const { isProduction } = opts;
  const checks: EnvCheck[] = [];
  const add = (
    key: string,
    severity: EnvSeverity,
    blocking: boolean,
    message: string,
  ) => checks.push({ key, severity, blocking, message });

  // --- Supabase (always required) -----------------------------------------
  const supaUrl = val(env, "NEXT_PUBLIC_SUPABASE_URL");
  const supaKey =
    val(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    val(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!supaUrl) {
    add("NEXT_PUBLIC_SUPABASE_URL", "error", true, "ausente");
  } else if (!isHttpUrl(supaUrl).ok) {
    add("NEXT_PUBLIC_SUPABASE_URL", "error", true, "não é uma URL http(s)");
  } else {
    add("NEXT_PUBLIC_SUPABASE_URL", "ok", true, "ok");
  }
  add(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    supaKey ? "ok" : "error",
    true,
    supaKey ? "ok" : "ausente (anon ou publishable)",
  );

  // --- App URL -----------------------------------------------------------
  const appUrlRaw = val(env, "NEXT_PUBLIC_APP_URL") || val(env, "APP_URL");
  if (!appUrlRaw) {
    add(
      "NEXT_PUBLIC_APP_URL",
      isProduction ? "error" : "warn",
      isProduction,
      isProduction
        ? "obrigatória em produção (usada nos links de convite e endereço)"
        : "ausente — dev usa http://localhost:3001",
    );
  } else {
    const parsed = isHttpUrl(appUrlRaw);
    if (!parsed.ok || !parsed.url) {
      add("NEXT_PUBLIC_APP_URL", "error", true, "não é uma URL http(s)");
    } else if (isProduction && parsed.url.protocol !== "https:") {
      add("NEXT_PUBLIC_APP_URL", "error", true, "deve ser https em produção");
    } else if (isProduction && isLocalHost(parsed.url)) {
      add("NEXT_PUBLIC_APP_URL", "error", true, "não pode ser localhost em produção");
    } else {
      add("NEXT_PUBLIC_APP_URL", "ok", isProduction, "ok");
    }
  }

  // --- Anthropic: Creator Score (optional, degrades) --------------------
  const anthKey = val(env, "ANTHROPIC_API_KEY");
  const anthModel = val(env, "ANTHROPIC_MODEL");
  if (anthKey && anthModel) {
    add("ANTHROPIC_MODEL", "ok", false, "Creator Score habilitado");
  } else if (!anthKey && !anthModel) {
    add(
      "ANTHROPIC_MODEL",
      "warn",
      false,
      "ausente — Creator Score fica indisponível (CRM funciona)",
    );
  } else {
    add(
      "ANTHROPIC_MODEL",
      "warn",
      false,
      "parcial — defina ANTHROPIC_API_KEY e ANTHROPIC_MODEL juntos",
    );
  }

  // --- Anthropic: support assistant (optional, degrades to ticket) ------
  const supportModel = val(env, "ANTHROPIC_SUPPORT_MODEL");
  if (anthKey && supportModel) {
    add("ANTHROPIC_SUPPORT_MODEL", "ok", false, "assistente de suporte habilitado");
  } else {
    add(
      "ANTHROPIC_SUPPORT_MODEL",
      "warn",
      false,
      "ausente — suporte com IA degrada para ticket humano",
    );
  }

  // --- Legal URLs ------------------------------------------------------
  for (const key of [
    "NEXT_PUBLIC_TERMS_URL",
    "NEXT_PUBLIC_PRIVACY_POLICY_URL",
  ]) {
    const raw = val(env, key);
    if (!raw) {
      add(
        key,
        isProduction ? "error" : "warn",
        isProduction,
        isProduction
          ? "obrigatória em produção — link legal no rodapé público"
          : "ausente",
      );
    } else if (!isHttpUrl(raw).ok) {
      add(key, "error", isProduction, "não é uma URL http(s) (javascript:/data: rejeitados)");
    } else {
      add(key, "ok", false, "ok");
    }
  }

  // --- Error monitoring (optional but recommended for go-live) --------
  const sentryDsn =
    val(env, "SENTRY_DSN") || val(env, "NEXT_PUBLIC_SENTRY_DSN");
  add(
    "SENTRY_DSN",
    sentryDsn ? "ok" : "warn",
    false,
    sentryDsn ? "monitoramento de erro ativo" : "ausente — sem captura de exceção em produção",
  );

  // --- Secret hygiene -------------------------------------------------
  for (const key of FORBIDDEN_PUBLIC_SECRETS) {
    if (val(env, key)) {
      add(key, "error", true, "segredo exposto com prefixo NEXT_PUBLIC_ — remova");
    }
  }
  if (val(env, "SUPABASE_SERVICE_ROLE_KEY") && !isProduction) {
    add(
      "SUPABASE_SERVICE_ROLE_KEY",
      "ok",
      false,
      "presente (scripts/testes) — nunca importar em src/",
    );
  }

  const errors = checks.filter((c) => c.severity === "error");
  const warnings = checks.filter((c) => c.severity === "warn");
  return {
    checks,
    errors,
    warnings,
    productionReady: !checks.some((c) => c.blocking && c.severity === "error"),
  };
}

/** Convenience wrapper over the current process environment. */
export function checkCurrentEnv(): EnvReport {
  return checkProductionEnv(process.env as EnvMap, {
    isProduction: process.env.NODE_ENV === "production",
  });
}
