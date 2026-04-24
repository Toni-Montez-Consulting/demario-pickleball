import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="legal-bg">
      <div className="legal-page">
        <Link href="/" className="legal-back">← Back to site</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-date">Effective April 23, 2026</p>

        <h2>What we collect</h2>
        <p>
          When you book a lesson or send an inquiry, we collect your name, email address,
          and phone number (optional). We do not collect payment information directly — payments
          are handled by third-party processors.
        </p>

        <h2>How we use your information</h2>
        <ul>
          <li>To confirm and manage your lesson booking</li>
          <li>To respond to your inquiries</li>
          <li>To send lesson reminders (if you opt in)</li>
        </ul>
        <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>

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

        <h2>Cookies</h2>
        <p>
          This site uses session cookies for authentication purposes only (admin login). We do not
          use tracking or advertising cookies.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? Email{" "}
          <a href="mailto:demariomontez10@gmail.com">demariomontez10@gmail.com</a> or call{" "}
          <a href="tel:4693719220">(469) 371-9220</a>.
        </p>
      </div>
    </div>
  );
}
