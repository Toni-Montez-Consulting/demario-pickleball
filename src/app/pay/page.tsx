import Link from "next/link";
import PaymentOptions from "@/components/PaymentOptions";
import { pageMetadata } from "@/lib/metadata";
import { eventAttributes } from "@/lib/analytics";

// Not indexed: students arrive from their confirmation email, and payment
// handles in search results add risk without bringing anyone new.
export const metadata = pageMetadata({
  path: "/pay",
  title: "Pay DeMario Montez — Pickleball Coach",
  description:
    "Send payment to DeMario Montez via Cash App, Zelle, or PayPal. Include your booking ID in the memo.",
  index: false,
});

export default function PayPage() {
  return (
    <div className="legal-bg">
      <main className="legal-page">
        <Link href="/" className="legal-back">← Back to site</Link>
        <h1>Pay DeMario</h1>
        <p className="legal-date">
          Already booked a lesson? Use one of the options below. Include your booking ID
          (shown on your confirmation) in the memo so Mario can match the payment. Any court
          reservation fee, if needed, is confirmed separately with your exact court plan.
        </p>

        <div className="pay-page-wrap">
          <PaymentOptions headingLevel={2} surface="pay_page" />
        </div>

        <p className="legal-date" style={{ marginTop: "2rem" }}>
          Questions about a payment? Email{" "}
          <a
            href="mailto:demariomontez10@gmail.com"
            {...eventAttributes("contact_click", { channel: "email", surface: "pay_page" })}
          >
            demariomontez10@gmail.com
          </a>{" "}
          or call{" "}
          <a
            href="tel:4693719220"
            {...eventAttributes("contact_click", { channel: "tel", surface: "pay_page" })}
          >
            (469) 371-9220
          </a>
          .
        </p>
      </main>
    </div>
  );
}
