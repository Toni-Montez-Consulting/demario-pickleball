// Renders the raster icons from the nav's "D" brand mark:
//   src/app/apple-icon.png  180x180, full-bleed (iOS rounds the corners itself)
//   src/app/favicon.ico     16, 32 and 48px PNGs in one ICO container
//
// Run:  node scripts/generate-icons.mjs
// Needs network access (Google Fonts) and the Chromium that @playwright/test
// installs. If the installed build does not match, point at one:
//   CHROMIUM_PATH=/path/to/chrome node scripts/generate-icons.mjs
//
// Rendered in Chromium rather than rasterised from src/app/icon.svg because
// librsvg does not understand the oklch() colours the site uses, and the mark
// should use the brand font, as the nav does (.brand-mark in globals.css).
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function markHtml(size, rounded) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=block" rel="stylesheet">
<style>
  * { margin: 0; }
  html, body { width: ${size}px; height: ${size}px; background: transparent; }
  .mark {
    width: ${size}px; height: ${size}px; display: grid; place-items: center;
    background: oklch(0.88 0.24 135); color: oklch(0.2 0.05 135);
    border-radius: ${rounded ? Math.round(size * 0.3) : 0}px;
    font: 700 ${Math.round(size * 0.56)}px "Space Grotesk", sans-serif;
  }
</style></head><body><div class="mark">D</div></body></html>`;
}

// ICO with PNG payloads: a 6-byte header, a 16-byte entry per image, then the
// PNG bytes. Every browser that requests /favicon.ico reads this form.
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
try {
  async function render(size, rounded) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(markHtml(size, rounded), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // check() is true when no face is registered at all, which is what a failed
    // Google Fonts request leaves. load() returns only faces that really loaded.
    const loaded = await page.evaluate(async () => {
      const faces = await document.fonts.load("700 20px 'Space Grotesk'").catch(() => []);
      return faces.length > 0 && faces.every((face) => face.status === "loaded");
    });
    if (!loaded) {
      throw new Error("Space Grotesk failed to load; refusing to ship a fallback-font icon");
    }
    const data = await page.screenshot({ type: "png", omitBackground: true });
    await page.close();
    return data;
  }

  await writeFile(path.join(root, "src/app/apple-icon.png"), await render(180, false));
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const size of sizes) pngs.push({ size, data: await render(size, true) });
  await writeFile(path.join(root, "src/app/favicon.ico"), ico(pngs));
  console.log("Wrote src/app/apple-icon.png and src/app/favicon.ico");
} finally {
  await browser.close();
}
