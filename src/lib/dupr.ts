import stats from "./dupr.json";

/**
 * DeMario's DUPR doubles rating and rankings, typed by hand until DUPR grants API
 * access. The hero, trust strip, About section, and meta description all read from
 * dupr.json, so an update is one edit there. The link-preview card is an image:
 * after an update, run `node scripts/generate-og-image.mjs` to redraw it.
 */
export const DUPR = stats;
