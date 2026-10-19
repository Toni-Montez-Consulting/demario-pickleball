import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists only indexable pages", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toEqual([
      "https://demariomontezpb.com",
      "https://demariomontezpb.com/privacy",
      "https://demariomontezpb.com/terms",
    ]);
    // /pay is noindex; listing it would contradict its robots tag.
    expect(urls.some((url) => url.endsWith("/pay"))).toBe(false);
  });
});
