import { describe, expect, it } from "vitest";
import { hasCronCredential } from "./cron-auth";

describe("hasCronCredential", () => {
  const token = "fake-cron-token-for-tests";

  it("accepts the exact header Vercel sends", () => {
    expect(hasCronCredential(`Bearer ${token}`, token)).toBe(true);
  });

  it("refuses anything else, including near misses", () => {
    expect(hasCronCredential(null, token)).toBe(false);
    expect(hasCronCredential("", token)).toBe(false);
    expect(hasCronCredential(token, token)).toBe(false);
    expect(hasCronCredential(`bearer ${token}`, token)).toBe(false);
    expect(hasCronCredential(`Bearer ${token} `, token)).toBe(false);
    expect(hasCronCredential(`Bearer ${token.slice(0, -1)}x`, token)).toBe(false);
    expect(hasCronCredential(`Bearer ${token}${token}`, token)).toBe(false);
  });
});
