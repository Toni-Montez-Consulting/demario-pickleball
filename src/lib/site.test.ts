import { describe, it, expect } from "vitest";
import { normalizeSiteUrl } from "./site";

describe("normalizeSiteUrl", () => {
  it("strips a trailing newline", () => {
    expect(normalizeSiteUrl("https://demariomontezpb.com\n")).toBe("https://demariomontezpb.com");
  });
  it("strips a trailing slash", () => {
    expect(normalizeSiteUrl("https://demariomontezpb.com/")).toBe("https://demariomontezpb.com");
  });
  it("strips surrounding whitespace, CR, and a trailing slash together", () => {
    expect(normalizeSiteUrl("  https://demariomontezpb.com/\r\n ")).toBe(
      "https://demariomontezpb.com"
    );
  });
  it("strips repeated trailing slashes", () => {
    expect(normalizeSiteUrl("https://demariomontezpb.com///")).toBe("https://demariomontezpb.com");
  });
  it("leaves a clean url alone", () => {
    expect(normalizeSiteUrl("https://demariomontezpb.com")).toBe("https://demariomontezpb.com");
  });
  it("falls back when the value is missing or blank", () => {
    expect(normalizeSiteUrl(undefined)).toBe("https://demariomontezpb.com");
    expect(normalizeSiteUrl("   \n")).toBe("https://demariomontezpb.com");
  });
  it("produces a url that survives URL parsing without a stray newline", () => {
    const url = new URL(normalizeSiteUrl("https://demariomontezpb.com\n"));
    expect(url.href).toBe("https://demariomontezpb.com/");
    expect(normalizeSiteUrl("https://demariomontezpb.com\n")).not.toContain("\n");
  });
});
