import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WAIVER_VERSION } from "@/lib/business";
import TermsContent, { TERMS_EFFECTIVE_DATE } from "./TermsContent";

// The text a student accepts, one block per line, as docs/terms/ archives it.
function acceptedText(): string {
  const { container } = render(<TermsContent />);
  const blocks = Array.from(container.querySelectorAll("h2, p, li"), (el) =>
    (el.textContent ?? "").replace(/\s+/g, " ").trim()
  );
  return [TERMS_EFFECTIVE_DATE, ...blocks].join("\n") + "\n";
}

describe("terms versioning", () => {
  // Each booking stores WAIVER_VERSION as the terms its student accepted. On
  // 2026-10-20 the text changed under the old version, so bookings stopped
  // naming the text they were made under. This keeps version and text locked.
  it("matches the archived text for the current WAIVER_VERSION", () => {
    const file = path.join(process.cwd(), "docs", "terms", `${WAIVER_VERSION}.txt`);
    const text = acceptedText();
    const archived = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : null;
    expect(
      archived,
      `No archive for terms version ${WAIVER_VERSION}. Save this as docs/terms/${WAIVER_VERSION}.txt:\n${text}`
    ).not.toBeNull();
    expect(
      text,
      "The terms changed without a new version. Follow the comment above TERMS_EFFECTIVE_DATE in src/components/TermsContent.tsx."
    ).toBe(archived);
  });
});
