import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="legal-bg">
      <div className="legal-page">
        <Link href="/" className="legal-back">← Back to site</Link>
        <h1>Coaching Agreement &amp; Terms of Service</h1>
        <p className="legal-date">Effective April 23, 2026</p>

        <h2>Services</h2>
        <p>
          DeMario Montez Pickleball Coaching provides one-on-one and group pickleball instruction
          in the Dallas–Fort Worth area. Your lesson time is reserved when you book, and
          Mario confirms the exact court afterward based on your preference, court availability,
          weather, and any venue rules. Lessons are provided as described at the time of booking
          (Foundations, Strategy Lab, or Group Clinic).
        </p>

        <h2>Pricing</h2>
        <ul>
          <li>Foundations (1-on-1) — $70 per session</li>
          <li>Strategy Lab (1-on-1) — $80 per session</li>
          <li>Group Clinic — $50 per player per session</li>
        </ul>
        <p>
          Prices are subject to change with reasonable notice. Lesson prices do not include
          third-party court reservation fees unless Mario confirms otherwise before the lesson.
          Public outdoor courts typically have no court fee; indoor or reserved venues may charge
          a separate court fee.
        </p>

        <h2>Cancellation &amp; Rescheduling</h2>
        <p>
          You may cancel or reschedule a lesson at no charge with at least <strong>24 hours&apos; notice</strong>{" "}
          before the scheduled start time. Cancellations made with less than 24 hours&apos; notice
          are subject to a cancellation fee equal to 50% of the lesson price.
          No-shows are charged the full lesson price.
        </p>

        <h2>Refunds</h2>
        <p>
          Refunds are not issued for completed sessions. If a session is cancelled by the coach,
          you will receive a full refund or reschedule at no charge.
        </p>

        <h2>Assumption of Risk &amp; Liability Waiver</h2>
        <p>
          Pickleball is a physical activity that involves inherent risks of injury, including but
          not limited to sprains, strains, falls, and cardiovascular exertion. By booking a lesson
          and agreeing to these terms, you acknowledge and voluntarily assume all risks associated
          with participation.
        </p>
        <p>
          You release and hold harmless DeMario Montez, his affiliates, host venues, and court
          providers from any and all claims, damages, or liability arising from participation in
          coaching sessions, including claims of negligence, to the maximum extent permitted by law.
        </p>
        <p>
          You represent that you are in adequate physical health to participate and that you have
          consulted a physician if you have any medical conditions that could be affected by
          physical activity.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          In no event shall DeMario Montez be liable for indirect, incidental, or consequential
          damages arising from the use of coaching services. Total liability shall not exceed the
          amount paid for the session in question.
        </p>

        <h2>Governing Law</h2>
        <p>
          These terms are governed by the laws of the State of Texas. Any disputes shall be
          resolved in the courts of Dallas County, Texas.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:demariomontez10@gmail.com">demariomontez10@gmail.com</a> or call{" "}
          <a href="tel:4693719220">(469) 371-9220</a>.
        </p>
      </div>
    </div>
  );
}
