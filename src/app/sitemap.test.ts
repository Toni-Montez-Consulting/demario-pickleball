import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists only indexable pages", () => {
    const urls = sitemap().map((entry) => entry.url);

    // Built from SITE_URL, as the sitemap is, so a preview origin passes too.
    expect(urls).toEqual([SITE_URL, `${SITE_URL}/privacy`, `${SITE_URL}/terms`]);
    // /pay is noindex; listing it would contradict its robots tag.
    expect(urls.some((url) => url.endsWith("/pay"))).toBe(false);
  });
});
