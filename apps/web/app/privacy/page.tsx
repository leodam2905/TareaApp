import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Tarea",
  description: "How Tarea collects, uses, and protects your personal information.",
};

const EFFECTIVE_DATE = "May 1, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-tarea-ink text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-tarea-sky text-sm font-medium hover:underline">
            ← Back to Tarea
          </Link>
          <h1 className="text-4xl font-extrabold text-white mt-6 mb-2">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="space-y-10 prose-custom">
          <Section title="1. Information We Collect">
            <p>We collect information you provide directly to us when you create an account, book a service, or communicate through the platform:</p>
            <ul>
              <li><strong>Account data:</strong> name, email address, phone number, password hash, and profile photo.</li>
              <li><strong>Location data:</strong> city, state, and zip code at registration; GPS coordinates during active bookings (handymen only, with your permission).</li>
              <li><strong>Payment data:</strong> billing information is processed by Stripe. We never store full card numbers.</li>
              <li><strong>Usage data:</strong> pages visited, bookings made, reviews submitted, and device information.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul>
              <li>To create and manage your account and bookings.</li>
              <li>To match customers with nearby handymen using location data.</li>
              <li>To process payments and send receipts via email.</li>
              <li>To send booking confirmations, reminders, and service updates.</li>
              <li>To detect and prevent fraud and abuse.</li>
              <li>To improve our platform through aggregated, anonymized analytics.</li>
            </ul>
          </Section>

          <Section title="3. Information Sharing">
            <p>We do not sell your personal information. We share data only as follows:</p>
            <ul>
              <li><strong>Between users:</strong> when a booking is created, your name, phone number, and relevant booking details are visible to the other party.</li>
              <li><strong>Service providers:</strong> Stripe (payments), Cloudinary (media storage), Resend (email), and Expo (push notifications) process data on our behalf under confidentiality agreements.</li>
              <li><strong>Legal requirements:</strong> we may disclose information when required by law or to protect our users.</li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <p>We retain your account data for as long as your account is active. You may request deletion of your account and associated data by contacting us at <a href="mailto:privacy@tarea.app" className="text-tarea-sky hover:underline">privacy@tarea.app</a>. Booking records may be retained for up to 7 years for financial and legal compliance.</p>
          </Section>

          <Section title="5. Location Data">
            <p>Handymen may optionally share live GPS location during an active booking via the "I'm On My Way" feature. This data is transmitted to the booked customer only and is not stored beyond the active booking session.</p>
          </Section>

          <Section title="6. Cookies">
            <p>We use a single HTTP-only session cookie to keep you signed in. We do not use third-party tracking or advertising cookies.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Opt out of marketing emails (unsubscribe link in every email).</li>
            </ul>
            <p>To exercise any of these rights, contact <a href="mailto:privacy@tarea.app" className="text-tarea-sky hover:underline">privacy@tarea.app</a>.</p>
          </Section>

          <Section title="8. Security">
            <p>We use industry-standard encryption (TLS) in transit and bcrypt hashing for passwords. Stripe handles all payment card data in their PCI-DSS compliant environment.</p>
          </Section>

          <Section title="9. Children">
            <p>Tarea is not directed at children under 13. We do not knowingly collect personal information from anyone under 13.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this policy from time to time. We will notify you of material changes via email and by updating the effective date above.</p>
          </Section>

          <Section title="11. Contact">
            <p>Questions about this privacy policy? Contact us at <a href="mailto:privacy@tarea.app" className="text-tarea-sky hover:underline">privacy@tarea.app</a>.</p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex gap-6 text-sm text-slate-500">
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-white transition-colors">Back to Tarea</Link>
        </div>
      </div>

      <style jsx>{`
        .prose-custom p { margin-bottom: 12px; line-height: 1.7; }
        .prose-custom ul { list-style: disc; padding-left: 20px; margin: 8px 0 12px; }
        .prose-custom li { margin-bottom: 6px; }
        .prose-custom strong { color: #e2e8f0; font-weight: 600; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      <div className="prose-custom">{children}</div>
    </section>
  );
}
