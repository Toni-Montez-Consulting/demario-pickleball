import type { Metadata } from "next";
import Link from "next/link";
import PaymentOptions from "@/components/PaymentOptions";

export const metadata: Metadata = {
  title: "Pay DeMario Montez — Pickleball Coach",
  description:
    "Send payment to DeMario Montez via Cash App, Zelle, or PayPal. Include your booking ID in the memo.",
};

export default function PayPage() {
  return (
    <div className="legal-bg">
      <div className="legal-page">
        <Link href="/" className="legal-back">← Back to site</Link>
        <h1>Pay DeMario</h1>
        <p className="legal-date">
          Already booked a lesson? Use one of the options below. Include your booking ID
          (shown on your confirmation) in the memo so Mario can match the payment. Any court
          reservation fee, if needed, is confirmed separately with your exact court plan.
        </p>

        <div className="pay-page-wrap">
          <PaymentOptions />
        </div>

        <p className="legal-date" style={{ marginTop: "2rem" }}>
          Questions about a payment? Email{" "}
          <a href="mailto:demariomontez10@gmail.com">demariomontez10@gmail.com</a> or call{" "}
          <a href="tel:4693719220">(469) 371-9220</a>.
        </p>
      </div>
    </div>
  );
}
