# Site Health and SEO Implementation Plan

**Goal:** Fix the live SEO breakage, the token/key coupling, and the accessibility failures found in the 2026-07-26 audit, then add the measurement the site currently lacks.

**Architecture:** Small, independent corrections to existing files. No new subsystems. Each task is separately revertible.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vercel (CLI + env), `@vercel/analytics`.

**Branch:** `fix/site-health-and-seo`, stacked on `feat/student-spine-review-loop`.

Stacked rather than branched off `master` because production is currently mid-state — the
database already has `students` and `reviews` but the deployed code predates them. One deploy
should carry both. Stacking also avoids conflicts on `Hero.tsx` and `globals.css`, which the
review branch already touched.

## Global Constraints

- Never commit secrets. Env values are set through `vercel env`, never checked in.
- Conventional Commits. One purpose per commit.
- `npm run ci` (typecheck → lint → test → build) must pass before each commit.
- Public-flow changes also require `npm run test:e2e`.
- No new colour literals. Adjust the existing token, do not add one.

## Evidence Behind These Fixes

Measured 2026-07-26 against the live site, not assumed:

| Finding | Evidence |
|---|---|
| `SITE_URL` newline | `robots.txt` renders `Sitemap: https://demariomontezpb.com\n/sitemap.xml`; every sitemap `<loc>` split; JSON-LD `url` is `"https://demariomontezpb.com\n"` |
| Contrast failure | `--fg-muted` computes to **3.94:1** on `--bg` and **3.65:1** on `--bg-2`; AA needs 4.5:1 |
| Heading skip | `Lessons.tsx` goes `h2 → h3 → h5` |
| No 404 | Only `global-error.tsx` exists; the review-token page calls `notFound()` |
| Hero unoptimised | `hero-ready.jpg` loads raw via CSS `background-image`; all six About images already use `next/image` |
| Lighthouse | Accessibility 94, SEO 92, Best Practices 100, LCP 471ms, CLS 0.00 |

## Deliberately Not Doing

**Review / AggregateRating structured data.** Researched 2026-07-27 against current Google
guidance: reviews a business collects and displays about itself on its own LocalBusiness site
are treated as **self-serving**. The markup validates but is **ignored for rich results** — it
produces no stars. It is not penalised, but it buys nothing, so it is not worth the surface
area. This reverses a recommendation made in the audit. Star rich results would require
product- or service-level pages with independent reviews, which is a different build.

Also out of scope here: the waitlist, the admin student record view, reminders, self-serve
reschedule, and the FAQ. Those are features, not corrections, and belong in their own round.

---

### Task 1: Harden SITE_URL against whitespace

**Files:** Modify `src/lib/site.ts`; test `src/lib/site.test.ts` (create)

The env value in Vercel carries a trailing newline. Fixing only the env var leaves the same
trap for the next person, so defend in code as well and fix the value.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/site.test.ts
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
    expect(normalizeSiteUrl("  https://demariomontezpb.com/\r\n ")).toBe("https://demariomontezpb.com");
  });
  it("leaves a clean url alone", () => {
    expect(normalizeSiteUrl("https://demariomontezpb.com")).toBe("https://demariomontezpb.com");
  });
  it("falls back when the value is missing or blank", () => {
    expect(normalizeSiteUrl(undefined)).toBe("https://demariomontezpb.com");
    expect(normalizeSiteUrl("   \n")).toBe("https://demariomontezpb.com");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/site.test.ts --no-file-parallelism`
Expected: FAIL — `normalizeSiteUrl` is not exported

- [ ] **Step 3: Implement**

```ts
// src/lib/site.ts
const FALLBACK_SITE_URL = "https://demariomontezpb.com";

/**
 * Environment values arrive with stray whitespace more often than anyone expects.
 * A trailing newline here silently corrupted robots.txt, every sitemap <loc>, and
 * the JSON-LD url fields in production. Trim before anything else touches it.
 */
export function normalizeSiteUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/+$/, "").trim();
  return trimmed || FALLBACK_SITE_URL;
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
```

- [ ] **Step 4: Confirm it passes**

Run: `npx vitest run src/lib/site.test.ts --no-file-parallelism`
Expected: PASS

- [ ] **Step 5: Fix the stored env value**

```bash
vercel env rm NEXT_PUBLIC_SITE_URL production --yes
printf 'https://demariomontezpb.com' | vercel env add NEXT_PUBLIC_SITE_URL production
```

`printf` without `\n` matters — `echo` is what introduced the newline.

- [ ] **Step 6: Commit**

```bash
git add src/lib/site.ts src/lib/site.test.ts
git commit -m "fix(seo): strip whitespace from SITE_URL so robots, sitemap, and JSON-LD are valid"
```

---

### Task 2: Decouple review tokens from the Supabase service-role key

**Files:** Vercel env only

`hashReviewToken` and `hashRequestIp` both fall back to `SUPABASE_SERVICE_ROLE_KEY` when
`RATE_LIMIT_SALT` is unset, and it is unset. Rotating the Supabase key would invalidate every
outstanding review link sitting in a student's inbox.

- [ ] **Step 1: Set the salt in all three environments**

```bash
SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
for env in production preview development; do printf '%s' "$SALT" | vercel env add RATE_LIMIT_SALT $env; done
vercel env ls | grep RATE_LIMIT_SALT
```

- [ ] **Step 2: Record the consequence**

Add to `docs/DEVELOPER_PLAN.md` under Long-Term Reference:

```markdown
- `RATE_LIMIT_SALT` salts both rate-limit IP hashes and review link tokens. Changing it
  invalidates every unused review link. Rotate it only deliberately.
```

- [ ] **Step 3: Commit**

```bash
git add docs/DEVELOPER_PLAN.md
git commit -m "docs: record that RATE_LIMIT_SALT invalidates outstanding review links"
```

---

### Task 3: Fix the contrast failure

**Files:** Modify `src/app/globals.css`

- [ ] **Step 1: Raise the muted token**

In `:root`, change:

```css
  --fg-muted: oklch(0.55 0.012 260);
```

to:

```css
  /* 0.55 measured 3.94:1 on --bg and 3.65:1 on --bg-2, both under the 4.5:1 AA
     floor for normal text. 0.62 measures 5.25:1 and 4.87:1. */
  --fg-muted: oklch(0.62 0.012 260);
```

- [ ] **Step 2: Check nothing else regressed**

Run: `npm run build`, then load the homepage and admin and confirm muted text reads as
secondary rather than primary. `--fg-dim` at 7.71:1 is untouched.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(a11y): raise --fg-muted to clear the 4.5:1 AA contrast floor"
```

---

### Task 4: Fix the heading order

**Files:** Modify `src/components/Lessons.tsx:61`

The lesson step heading is `<h5>` inside a section that runs `h2 → h3`, skipping `h4`.

- [ ] **Step 1: Change the tag**

```tsx
                  <h4>{s.h}</h4>
```

- [ ] **Step 2: Carry the styling across**

`globals.css` styles this by tag. Find the rule covering the lesson step heading and make it
apply to the new tag, matching the existing size and weight exactly. The visual result must be
identical — this is a semantics fix, not a design change.

- [ ] **Step 3: Commit**

```bash
git add src/components/Lessons.tsx src/app/globals.css
git commit -m "fix(a11y): use h4 for lesson steps so heading levels do not skip"
```

---

### Task 5: Add a real 404 page

**Files:** Create `src/app/not-found.tsx`

This became load-bearing when the review-token page started calling `notFound()`. A student
following a used or expired link currently lands on an unstyled Next.js default.

- [ ] **Step 1: Write the page**

```tsx
// src/app/not-found.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found · DeMario Montez Pickleball",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="notfound-page">
      <p className="kicker">404</p>
      <h1>That page isn&rsquo;t here.</h1>
      <p>
        The link may be old, or the review link may have already been used. Nothing is broken
        on your end.
      </p>
      <div className="cta-row">
        <Link className="btn btn-primary" href="/">
          Back to the site
        </Link>
        <a className="btn btn-ghost" href="tel:4693719220">
          Call DeMario
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Style it**

Append to `globals.css`, reusing the `.review-page` rhythm:

```css
/* ── 404 ──────────────────────────────────────────────────────────────── */
.notfound-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 8rem 1.25rem 6rem;
}
.notfound-page h1 {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  margin: 0.5rem 0 0.75rem;
}
.notfound-page p {
  color: var(--fg-dim);
  margin-bottom: 2rem;
}
```

- [ ] **Step 3: Verify**

Run `npm run build`, start it, and confirm `/definitely-not-a-page` returns 404 with the
styled page and that `/review/bogus-token` does too.

- [ ] **Step 4: Commit**

```bash
git add src/app/not-found.tsx src/app/globals.css
git commit -m "feat(site): add a styled 404 with a route back and a phone number"
```

---

### Task 6: Serve the hero image through next/image

**Files:** Modify `src/components/Hero.tsx`, `src/app/globals.css`

`hero-ready.jpg` is the only above-the-fold asset skipping optimisation, because a CSS
`background-image` never reaches the AVIF/WebP pipeline configured in `next.config.ts`.

- [ ] **Step 1: Replace the background div**

```tsx
import Image from "next/image";
```

```tsx
      <div className="hero-bg">
        <Image
          src="/img/hero-ready.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-bg-img"
        />
      </div>
```

`alt=""` is correct: the image is decorative and the headline carries the meaning. `priority`
because it is the LCP candidate and must not be lazy-loaded.

- [ ] **Step 2: Move the styling onto the image**

`.hero-bg` currently carries `background-size`, `background-position`, and `filter`. The
gradient scrim in `.hero-bg::after` must stay above the image.

```css
.hero-bg {
  position: absolute; inset: 0;
  overflow: hidden;
}
.hero-bg-img {
  object-fit: cover;
  object-position: 58% 20%;
  filter: saturate(0.9) contrast(1.05);
}
.hero-bg::after {
  content: "";
  position: absolute; inset: 0;
  z-index: 1;
  background:
    linear-gradient(180deg,
      color-mix(in oklab, var(--bg) 55%, transparent) 0%,
      color-mix(in oklab, var(--bg) 25%, transparent) 30%,
      color-mix(in oklab, var(--bg) 70%, transparent) 55%,
      color-mix(in oklab, var(--bg) 92%, transparent) 75%,
      var(--bg) 100%);
}
```

- [ ] **Step 3: Verify the scrim still reads**

Build and load the homepage. The headline must stay legible against the photo. If the scrim
sits under the image, raise its `z-index`. Confirm the network panel shows the hero served
from `/_next/image`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Hero.tsx src/app/globals.css
git commit -m "perf(site): serve the hero photo through next/image for avif/webp"
```

---

### Task 7: Add Vercel Web Analytics

**Files:** Modify `package.json`, `src/app/layout.tsx`

Verified 2026-07-27: the current package is `@vercel/analytics`, the App Router import is
`@vercel/analytics/next`, and it is cookieless — so it does not by itself require a consent
banner. This is what unblocks the P2 item that was deferred pending a consent policy.

- [ ] **Step 1: Install**

```bash
npm i @vercel/analytics
```

- [ ] **Step 2: Mount it**

In `src/app/layout.tsx`:

```tsx
import { Analytics } from "@vercel/analytics/next";
```

```tsx
      <body>
        {children}
        <Analytics />
      </body>
```

- [ ] **Step 3: Enable it in the Vercel dashboard**

Web Analytics has to be switched on for the project or the component collects nothing. This is
a manual step — record it as outstanding if it has not been done.

- [ ] **Step 4: Verify**

Run `npm run ci`. Confirm the build succeeds and no consent-gated code path was added.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx
git commit -m "feat(site): add cookieless Vercel Web Analytics"
```

---

### Task 8: Enrich the LocalBusiness structured data

**Files:** Modify `src/app/layout.tsx`

The JSON-LD is thin for a service-area business. No `image`, no `areaServed`, no `sameAs` on
the business node, and no link between the business and the coach.

Deliberately **not** adding `aggregateRating` — see "Deliberately Not Doing" above.

- [ ] **Step 1: Extend the LocalBusiness node**

```ts
      "@type": "SportsActivityLocation",
      "@id": `${SITE_URL}/#business`,
      name: "DeMario Montez Pickleball Coaching",
      url: SITE_URL,
      image: `${SITE_URL}/img/hero-ready.jpg`,
      telephone: "+14693719220",
      email: "demariomontez10@gmail.com",
      priceRange: "$$",
      areaServed: [
        { "@type": "City", name: "Dallas" },
        { "@type": "City", name: "Fort Worth" },
        { "@type": "City", name: "Farmers Branch" },
        { "@type": "City", name: "Plano" },
      ],
      sameAs: [
        "https://instagram.com/Alexanderiio",
        "https://tiktok.com/@DemarioMontez",
        "https://facebook.com/demario.montez.9/",
      ],
      employee: { "@id": `${SITE_URL}/#coach` },
```

Keep the existing `address` and `geo` nodes as they are.

**Open question, not a code change:** confirm the Instagram handle `Alexanderiio` is the one
DeMario wants published. It appears in the footer and here in `sameAs`, which asserts identity
to search engines.

- [ ] **Step 2: Verify the JSON parses**

```bash
npm run build
```

Then load the page and confirm the JSON-LD block parses and the `url` field has no `\n`.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(seo): enrich LocalBusiness structured data with areaServed and profiles"
```

---

### Task 9: Verify and document

- [ ] **Step 1: Full verification**

```bash
npm run ci && npm run test:e2e
```

Report the real output. If anything fails, say so rather than calling this done.

- [ ] **Step 2: Confirm the SEO fix end to end**

After deploy, fetch and confirm no stray newline:

```bash
curl -s https://demariomontezpb.com/robots.txt
curl -s https://demariomontezpb.com/sitemap.xml | head -8
```

- [ ] **Step 3: Update the docs**

Add a shipped section to `docs/DEVELOPER_PLAN.md`, and move "privacy-conscious analytics" out
of Deferred P2 now that it is built.

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: record the site health and SEO pass"
```

---

## Manual Steps That Cannot Be Done From The Repo

1. Replace `NEXT_PUBLIC_SITE_URL` in Vercel with a newline-free value (Task 1 Step 5).
2. Set `RATE_LIMIT_SALT` in all three environments (Task 2).
3. Enable Web Analytics in the Vercel project dashboard (Task 7 Step 3).
4. Confirm the Instagram handle with DeMario (Task 8).
5. Redeploy, since GitHub auto-deploy is not firing for this project.

## Next Round, Not This One

Ranked for a coach who is capacity-constrained rather than lead-constrained:

1. **Waitlist on unavailable slots** — captures demand he currently loses, and gives him a
   list to fill last-minute cancellations from. Needs the student spine, which now exists.
2. **Admin student record view** — lesson history, notes, last seen, one-tap rebook. The
   backbone is built and has no surface.
3. **24-hour reminders and self-serve reschedule** — the largest cut to his phone time.
4. **FAQ / "your first lesson"** — conversion for beginners, and something for Google to index
   beyond a single page.
