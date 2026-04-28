interface PaymentOptionsProps {
  bookingId?: string;
  amount?: string;
}

const CASH_APP_URL = "https://cash.app/$DeMarioMontez1";
const ZELLE_URL =
  "https://enroll.zellepay.com/qr-codes?data=eyJuYW1lIjoiREVNQVJJTyIsImFjdGlvbiI6InBheW1lbnQiLCJ0b2tlbiI6IjQ2OTM3MTkyMjAifQ==";
const PAYPAL_QR_SRC = "/img/paypal-qr.png";

export default function PaymentOptions({ bookingId, amount }: PaymentOptionsProps) {
  const shortId = bookingId ? bookingId.slice(0, 8).toUpperCase() : null;
  const memo = shortId ? `Lesson ${shortId}` : null;

  return (
    <div className="pay-options">
      <div className="pay-options-header">
        <h4>Pay DeMario</h4>
        {amount && <span className="pay-amount">{amount}</span>}
      </div>
      {memo && (
        <p className="pay-memo">
          Pay before your lesson and include <strong>{memo}</strong> in the memo so Mario can
          match your payment to this lesson.
        </p>
      )}
      <p className="pay-fee-note">
        Court reservation fees, if any, are confirmed separately by Mario before the lesson.
      </p>

      <a
        href={CASH_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pay-card pay-cashapp"
      >
        <div className="pay-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.4 3H6.6A3.6 3.6 0 0 0 3 6.6v10.8A3.6 3.6 0 0 0 6.6 21h10.8a3.6 3.6 0 0 0 3.6-3.6V6.6A3.6 3.6 0 0 0 17.4 3zM15.5 10.1a.5.5 0 0 1-.7 0 3.2 3.2 0 0 0-2.2-.9c-.7 0-1.5.3-1.5 1s1 1.2 2 1.5c1.8.5 3.4 1.2 3.4 3.1 0 2-1.6 3.4-4 3.6l-.2 1c0 .2-.2.3-.4.3h-1.4a.4.4 0 0 1-.4-.5l.2-1.1a5.4 5.4 0 0 1-2.5-1.4.5.5 0 0 1 0-.7l.9-.9a.5.5 0 0 1 .7 0 3.5 3.5 0 0 0 2.5 1c.9 0 1.6-.5 1.6-1.2 0-.8-.8-1-2.2-1.5-1.4-.5-3.2-1.2-3.2-3.1 0-2 1.7-3.2 3.8-3.4l.2-1c0-.2.2-.3.4-.3h1.4c.3 0 .5.2.4.5l-.2 1.1c.8.3 1.5.7 2 1.2.2.2.2.5 0 .7l-.8 1z" />
          </svg>
        </div>
        <div className="pay-card-body">
          <div className="pay-card-title">Cash App</div>
          <div className="pay-card-sub">$DeMarioMontez1</div>
        </div>
        <div className="pay-card-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>
      </a>

      <a
        href={ZELLE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pay-card pay-zelle"
      >
        <div className="pay-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm3.8 14.6H8.2a.6.6 0 0 1-.5-.9l4.4-6.4H9.4a.6.6 0 0 1-.6-.6V7.4a.6.6 0 0 1 .6-.6h5.8a.6.6 0 0 1 .5.9l-4.3 6.4h3.6a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 1-.8.6z" />
          </svg>
        </div>
        <div className="pay-card-body">
          <div className="pay-card-title">Zelle</div>
          <div className="pay-card-sub">(469) 371-9220</div>
        </div>
        <div className="pay-card-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>
      </a>

      <div className="pay-card pay-paypal">
        <div className="pay-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.3 21.5H5.4a.6.6 0 0 1-.6-.7L7.5 3.9a.8.8 0 0 1 .8-.7h6.7c3.2 0 5.3 1.6 4.9 4.7-.5 3.5-3.1 5.3-6.5 5.3h-2a.8.8 0 0 0-.8.7l-.8 5a.8.8 0 0 1-.8.6h-.7zM13.8 6H11l-.8 5.2H12c2 0 3.3-1 3.6-2.8.2-1.6-.7-2.4-1.8-2.4z" />
          </svg>
        </div>
        <div className="pay-card-body">
          <div className="pay-card-title">PayPal</div>
          <div className="pay-card-sub">Scan the QR below</div>
        </div>
      </div>
      <div className="pay-qr-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PAYPAL_QR_SRC}
          alt="PayPal QR code to pay DeMario Montez"
          className="pay-qr"
          loading="lazy"
        />
        <p className="pay-qr-caption">Scan to pay DeMario Montez</p>
      </div>
    </div>
  );
}
