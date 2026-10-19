import { describe, expect, it } from "vitest";
import { OG_IMAGE, pageMetadata } from "./metadata";

describe("pageMetadata", () => {
  it("gives an indexable page its own canonical, og:url, and the preview card", () => {
    const meta = pageMetadata({ path: "/privacy", title: "Privacy", description: "How data is used." });

    expect(meta.alternates).toEqual({ canonical: "/privacy" });
    expect(meta.robots).toBeUndefined();
    expect(meta.openGraph).toMatchObject({ url: "/privacy", title: "Privacy", images: [OG_IMAGE] });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: [OG_IMAGE.url] });
  });

  it("marks a noindex page and does not give it a canonical", () => {
    const meta = pageMetadata({ path: "/pay", title: "Pay", description: "Payment options.", index: false });

    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toBeUndefined();
    // Still previews as itself when someone texts the link.
    expect(meta.openGraph).toMatchObject({ url: "/pay", title: "Pay" });
  });
});
