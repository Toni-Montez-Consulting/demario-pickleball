// Supabase is retiring the JWT-based anon and service_role keys by the end of
// 2026 (supabase.com/docs/guides/getting-started/migrating-to-new-api-keys,
// read 2026-10-24). The new keys are read first. The legacy variables stay as
// a fallback until the legacy keys are switched off in Supabase; then they can
// go. The server-only key lives in ./server.ts, which browser code never loads.

/** The key safe to ship to browsers. It maps to the anon role, so RLS applies. */
export function supabaseBrowserKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Supabase browser key missing: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }
  return key;
}
