import Link from "next/link";
import type { Metadata } from "next";
import { COACH_PHONE_TEL } from "@/lib/business";
import { eventAttributes } from "@/lib/analytics";

// No robots entry: Next adds <meta name="robots" content="noindex"> to every
// not-found response itself, and a second tag here only duplicated it.
export const metadata: Metadata = {
  title: "Page not found · DeMario Montez Pickleball",
};

/**
 * Reached by any unknown route, and by the review-token page when a link has
 * expired or was already used — so it needs to reassure rather than just say 404.
 */
export default function NotFound() {
  return (
    <main className="notfound-page">
      <p className="kicker">404</p>
      <h1>That page isn&rsquo;t here.</h1>
      <p>
        The link may be old, or a review link may have already been used. Nothing is broken on
        your end.
      </p>
      <div className="cta-row">
        <Link className="btn btn-primary" href="/">
          Back to the site
        </Link>
        <a
          className="btn btn-ghost"
          href={`tel:${COACH_PHONE_TEL}`}
          {...eventAttributes("contact_click", { channel: "tel", surface: "not_found" })}
        >
          Call DeMario
        </a>
      </div>
    </main>
  );
}
