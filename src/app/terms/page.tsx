import Link from "next/link";
import TermsContent, { TERMS_EFFECTIVE_DATE } from "@/components/TermsContent";

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
