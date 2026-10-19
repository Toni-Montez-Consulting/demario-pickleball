import Link from "next/link";
import TermsContent, { TERMS_EFFECTIVE_DATE } from "@/components/TermsContent";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  path: "/terms",
  title: "Coaching Agreement & Terms · DeMario Montez Pickleball",
  description:
    "The coaching agreement students accept when booking with DeMario Montez: pricing, cancellation and rescheduling, refunds, and the liability waiver.",
});

export default function TermsPage() {
  return (
    <div className="legal-bg">
      <div className="legal-page">
        <Link href="/" className="legal-back">← Back to site</Link>
        <h1>Coaching Agreement &amp; Terms of Service</h1>
        <p className="legal-date">{TERMS_EFFECTIVE_DATE}</p>
        <TermsContent />
      </div>
    </div>
  );
}
