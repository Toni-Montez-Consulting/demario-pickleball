/**
 * The path to send someone to after signing in, kept on this site. The
 * sign-in link's `next` came straight from the URL, so `?next=.evil.example`
 * redirected to https://demariomontezpb.com.evil.example and `//evil.example`
 * to another site. Anything that does not resolve to this origin falls back to
 * Admin.
 */
export function safeNextPath(next: string | null, origin: string, fallback = "/admin"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const target = new URL(next, origin);
    if (target.origin !== origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
