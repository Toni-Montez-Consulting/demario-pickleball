import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { PRELOADED_FONTS } from "./fonts";

// Vitest runs from the repo root, as `npm run test` does in CI.
const root = process.cwd();
const css = readFileSync(path.join(root, "src/app/fonts.css"), "utf8");
const referenced = [...new Set([...css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((match) => match[1]))];

describe("self-hosted fonts", () => {
  it("finds the font files fonts.css declares", () => {
    expect(referenced.length).toBeGreaterThan(0);
  });

  it("serves every file fonts.css references from public/fonts", () => {
    for (const href of referenced) {
      expect(existsSync(path.join(root, "public", href)), href).toBe(true);
    }
  });

  it("preloads only files fonts.css actually uses", () => {
    for (const href of PRELOADED_FONTS) {
      expect(referenced, href).toContain(href);
    }
  });

  it("ships no woff2 file that fonts.css does not reference", () => {
    const shipped = readdirSync(path.join(root, "public/fonts"))
      .filter((file) => file.endsWith(".woff2"))
      .map((file) => `/fonts/${file}`);
    expect(shipped.sort()).toEqual([...referenced].sort());
  });
});
