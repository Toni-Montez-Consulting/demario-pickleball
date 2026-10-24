import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { eventAttributes } from "@/lib/analytics";

export const metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy Policy · DeMario Montez Pickleball",
  description:
    "How DeMario Montez Pickleball Coaching collects, uses, and protects booking details, including the Google Calendar availability check.",
});

export default function PrivacyPage() {
  return (
    <div className="legal-bg">
      <main className="legal-page">
        <Link href="/" className="legal-back">← Back to site</Link>
        <h1>Privacy Policy</h1>
        {/* Editing this page? Bump its date in LEGAL_LAST_MODIFIED (src/app/sitemap.ts). */}
        <p className="legal-date">Effective April 27, 2026 · Updated October 24, 2026</p>

        <h2>What we collect</h2>
        <p>
          When you book a lesson or send an inquiry, we collect your name, email address,
          phone number, preferred court setup, and optional preferred area or court notes. We do
          not collect payment information directly — payments are handled by third-party processors.
        </p>
        <p>
          When you write a review, we collect your star rating, any words you add, the name you
          want shown, and, on the public review form, an email or phone number so DeMario knows
          who you are. With your permission, given by the checkbox on the form, the rating, words,
          and name are published on this site; your email or phone number never is. A review with
          words sent from the private link in our email appears right away, and DeMario can take it
          down. A review sent from the public form appears only after he approves it.
        </p>
        <p>
          To slow down spam, when you book, send an inquiry, or write a review, the site also
          stores a scrambled one-way code made from your IP address (a salted hash), not the
          address itself. It cannot be turned back into your address, and it is used only to slow
          down or spot repeated and abusive submissions.
        </p>

        <h2>How we use your information</h2>
        <ul>
          <li>To confirm and manage your lesson booking</li>
          <li>To respond to your inquiries</li>
          <li>To remind you by email the day before a lesson you booked on this site</li>
          <li>
            To ask you once by email for a review after DeMario confirms that a lesson you booked
            on this site took place, with a link to book your next one
          </li>
        </ul>
        <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>

        <h2>Google Calendar availability data</h2>
        <p>
          DeMario may connect his Google Calendar so this site can check whether a
          requested lesson time is already busy. The site uses Google Calendar FreeBusy
          access only to read busy time ranges for scheduling availability. It does not
          request event titles, notes, locations, attendees, or event descriptions.
        </p>
        <p>
          Google Calendar availability data is used only to prevent double-booking lessons.
          It is not sold, used for advertising, or used to build marketing profiles.
          OAuth tokens are stored server-side as deployment secrets, and Google Calendar
          data is not shown to students.
        </p>
        <p>
          This site&apos;s use and transfer of information received from Google APIs will adhere
          to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>, including the Limited Use requirements. DeMario can revoke access at any
          time from his Google Account permissions or by removing the Google OAuth
          credentials from the site&apos;s deployment settings.
        </p>

        <h2>Data storage</h2>
        <p>
          Your data is stored securely via Supabase (a managed PostgreSQL provider). Supabase
          processes data in accordance with GDPR and SOC 2 standards. For more information, see{" "}
          <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
            Supabase&apos;s privacy policy
          </a>.
        </p>

        <h2>Data retention</h2>
        <p>
          We retain booking and inquiry records for up to 2 years for scheduling and
          business record-keeping purposes.
        </p>

        <h2>Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal data at any time.
          To make a request, email{" "}
          <a href="mailto:demariomontez10@gmail.com">demariomontez10@gmail.com</a>.
          We will respond within 30 days.
        </p>

        <h2>Cookies and analytics</h2>
        <p>
          This site uses session cookies for authentication purposes only (admin login). We do not
          use tracking or advertising cookies.
        </p>
        <p>
          We measure page views and a few anonymous interactions using Vercel Web Analytics,
          which is cookieless. It records the page visited, referrer, and general device type,
          and counts actions such as which booking button was tapped, how far the booking form
          got, and whether a payment or partner-platform link was opened. Those counts never
          include your name, email address, phone number, or anything you type into a form. It
          does not set cookies, does not build a profile of you, and does not follow you to other
          websites.
        </p>
        <p>
          Some links DeMario shares, such as the one in his Instagram or TikTok bio, on his QR
          card, or in the email asking for a review, carry a short label naming where they were
          shared. If you arrive through one,
          your browser keeps that label for the current tab only (session storage, not a
          cookie), and a booking you make sends it along so DeMario knows where you found him.
          It is one of a few fixed words, such as &ldquo;instagram&rdquo;, and never anything
          about you.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? Email{" "}
          <a
            href="mailto:demariomontez10@gmail.com"
            {...eventAttributes("contact_click", { channel: "email", surface: "privacy" })}
          >
            demariomontez10@gmail.com
          </a>{" "}
          or call{" "}
          <a
            href="tel:4693719220"
            {...eventAttributes("contact_click", { channel: "tel", surface: "privacy" })}
          >
            (469) 371-9220
          </a>
          .
        </p>
      </main>
    </div>
  );
}
