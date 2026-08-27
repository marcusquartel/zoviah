/**
 * Public Supabase credentials.
 *
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the legacy name and is still fully
 * supported. Newer Supabase projects issue a "publishable" key
 * (`sb_publishable_...`); we accept it under
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as a fallback so either works.
 *
 * The `service_role` / secret key must NEVER be referenced here — this module
 * is imported by browser code.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (veja .env.example).",
    );
  }
  return { url, anonKey };
}
