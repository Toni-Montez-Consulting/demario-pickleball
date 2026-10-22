import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

const ORIGIN = "https://demariomontezpb.com";

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/admin", ORIGIN)).toBe("/admin");
    expect(safeNextPath("/admin/reviews?tab=pending", ORIGIN)).toBe("/admin/reviews?tab=pending");
  });

  it("refuses anything that leaves the site", () => {
    expect(safeNextPath(".evil.example", ORIGIN)).toBe("/admin");
    expect(safeNextPath("//evil.example/pay", ORIGIN)).toBe("/admin");
    // Browsers read "/\" as "//", another host.
    expect(safeNextPath(String.raw`/\evil.example`, ORIGIN)).toBe("/admin");
    expect(safeNextPath("https://evil.example", ORIGIN)).toBe("/admin");
    expect(safeNextPath(null, ORIGIN)).toBe("/admin");
  });
});
