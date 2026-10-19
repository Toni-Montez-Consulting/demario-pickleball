// Renders the 1200x630 link-preview card to public/img/og-card.jpg.
//
// Run:  node scripts/generate-og-image.mjs
// Needs network access (Google Fonts) and the Chromium that @playwright/test
// installs. If the installed build does not match, point at one:
//   CHROMIUM_PATH=/path/to/chrome node scripts/generate-og-image.mjs
//
// Re-run whenever src/lib/dupr.json changes. The card reads its numbers from
// there, as the hero, trust strip, and About section do.
//
// A static file rather than a next/og route: the card uses the site's own
// fonts and photo at full fidelity, and nothing renders at request time.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dupr = JSON.parse(await readFile(path.join(root, "src/lib/dupr.json"), "utf8"));
const STATS = [
  [dupr.doublesShort, "Doubles DUPR"],
  [`Top ${dupr.topPercent}%`, "DUPR worldwide"],
  [`Top ${dupr.dfwTop}`, "DFW players"],
];
const photo = await readFile(path.join(root, "public/img/hero-ready.jpg"));
const out = path.join(root, "public/img/og-card.jpg");

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Space+Grotesk:wght@600&display=block" rel="stylesheet">
<style>
  :root {
    --bg: oklch(0.17 0.01 260);
    --fg: oklch(0.97 0.005 260);
    --fg-dim: oklch(0.72 0.01 260);
    --line: oklch(0.32 0.013 260);
    --accent: oklch(0.88 0.24 135);
  }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: var(--bg); overflow: hidden; }
  .card { position: relative; width: 1200px; height: 630px; font-family: Inter, sans-serif; color: var(--fg); }
  .photo {
    position: absolute; top: 0; right: 0; width: 560px; height: 630px;
    background: url(data:image/jpeg;base64,${photo.toString("base64")}) center 30% / cover no-repeat;
  }
  /* Fades the photo into the page colour so the copy never sits on the image. */
  .photo::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, var(--bg) 0%, color-mix(in oklab, var(--bg) 55%, transparent) 30%, transparent 62%);
  }
  .copy { position: absolute; top: 72px; left: 72px; width: 660px; }
  .eyebrow {
    display: inline-flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 999px;
    background: color-mix(in oklab, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 35%, transparent);
    font-size: 17px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent);
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px var(--accent); }
  h1 {
    font-family: "Space Grotesk", sans-serif; font-weight: 600; font-size: 104px;
    line-height: 0.92; letter-spacing: -0.02em; margin: 28px 0 0;
  }
  h1 em { font-style: italic; color: var(--accent); }
  .stats { display: inline-flex; margin-top: 44px; border-top: 1px solid var(--line); padding-top: 26px; }
  .stat { padding-right: 32px; margin-right: 32px; border-right: 1px solid var(--line); }
  .stat:last-child { border-right: 0; margin-right: 0; padding-right: 0; }
  .stat b { display: block; font-family: "Space Grotesk", sans-serif; font-weight: 600; font-size: 46px; letter-spacing: -0.02em; line-height: 1; }
  .stat span { display: block; margin-top: 10px; font-size: 15px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-dim); }
  .url { position: absolute; left: 72px; bottom: 56px; font-size: 20px; font-weight: 500; color: var(--fg-dim); }
</style></head>
<body><div class="card">
  <div class="photo"></div>
  <div class="copy">
    <div class="eyebrow"><span class="dot"></span>Dallas–Fort Worth · Pickleball coach</div>
    <h1>DeMario<br><em>Montez.</em></h1>
    <div class="stats">
      ${STATS.map(([num, label]) => `<div class="stat"><b>${num}</b><span>${label}</span></div>`).join("")}
    </div>
  </div>
  <div class="url">demariomontezpb.com</div>
</div></body></html>`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // check() is true when no face is registered at all, which is what a failed
  // Google Fonts request leaves. load() returns only faces that really loaded.
  const missing = await page.evaluate(async (wanted) => {
    const failed = [];
    for (const font of wanted) {
      const faces = await document.fonts.load(font).catch(() => []);
      if (!faces.length || faces.some((face) => face.status !== "loaded")) failed.push(font);
    }
    return failed;
  }, ["600 20px 'Space Grotesk'", "600 20px Inter", "500 20px Inter"]);
  // A fallback font would ship a card that does not look like the site.
  if (missing.length) throw new Error(`Fonts failed to load: ${missing.join(", ")}`);
  await page.screenshot({ path: out, type: "jpeg", quality: 88 });
  console.log(`Wrote ${path.relative(root, out)}`);
} finally {
  await browser.close();
}
