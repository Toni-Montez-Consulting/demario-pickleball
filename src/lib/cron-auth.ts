import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries Vercel's cron credential, `Authorization: Bearer
 * <token>`. Like the signed-link checks, the comparison takes the same time
 * however much of the header matches, so timing cannot reveal the token.
 * Each route still answers "not configured" itself when no token is set.
 */
export function hasCronCredential(authorization: string | null, expectedToken: string): boolean {
  const given = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${expectedToken}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
