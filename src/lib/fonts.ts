/**
 * Self-hosted font files the root layout preloads. The Latin subsets carry
 * nearly all of the site's text; next/font preloaded these two before
 * src/app/fonts.css replaced it. The filenames carry a content hash, so they
 * must match fonts.css and public/fonts; src/lib/fonts.test.ts checks that.
 */
export const PRELOADED_FONTS = [
  "/fonts/inter-latin.83afe278.woff2",
  "/fonts/space-grotesk-latin.0c89a48f.woff2",
] as const;
