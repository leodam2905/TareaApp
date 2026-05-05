import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service – Tarea",
  description: "The terms that govern your use of the Tarea handyman marketplace.",
};

const EFFECTIVE_DATE = "May 1, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-tarea-ink text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-tarea-sky text-sm font-medium hover:underline">
            ← Back to Tarea
          </Link>
          <h1 className="text-4xl font-extrabold text-white mt-6 mb-2">Terms of Service</h1>
          <p className="text-slate-500 text-sm">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="space-y-10 prose-custom">
          <Section title="1. Acceptance">
            <p>By creating an account or using Tarea ("the Platform", "we", "us"), you agree to these Terms of Service. If you do not agree, do not use the Platform.</p>
          </Section>

          <Section title="2. The Platform">
            <p>Tarea is a marketplace that connects customers ("Customers") with independent service providers ("Handymen"). Tarea is not an employer of Handymen and does not guarantee the quality or completion of any service. Handymen are independent contractors solely responsible for the services they provide.</p>
          </Section>

          <Section title="3. Account Eligibility">
            <ul>
              <li>You must be at least 18 years old.</li>
              <li>You must provide accurate and complete information at registration.</li>
              <li>You are responsible for all activity under your account.</li>
              <li>You may not create an account on behalf of someone else without authorization.</li>
            </ul>
          </Section>

          <Section title="4. Bookings and Payments">
            <ul>
              <li>Customers pay the service price plus a 10% platform fee at checkout.</li>
              <li>Handymen receive 90% of the agreed service price after Tarea's fee. Payouts are processed via Stripe Connect.</li>
              <li>All payments are processed by Stripe and subject to Stripe's Terms of Service.</li>
              <li>Tarea does not hold funds; payments are transferred to Handyman Stripe accounts upon booking completion.</li>
            </ul>
          </Section>

          <Section title="5. Cancellation and Refunds">
            <ul>
              <li><strong>Full refund:</strong> Cancel more than 24 hours before the scheduled time.</li>
              <li><strong>50% refund:</strong> Cancel within 24 hours of the scheduled time. The Handyman receives 50% of their net fee to compensate for the last-minute cancellation.</li>
              <li>No refund is issued after a service has been marked as completed.</li>
              <li>Disputes regarding completed services may be submitted within 7 days of completion and will be reviewed by Tarea admin.</li>
            </ul>
          </Section>

          <Section title="6. Handyman Obligations">
            <p>Handymen agree to:</p>
            <ul>
              <li>Complete booked services as described and on schedule.</li>
              <li>Maintain all required licenses and insurance for their trade.</li>
              <li>Treat customers with professionalism and respect.</li>
              <li>Not solicit customers to transact outside the Platform.</li>
            </ul>
          </Section>

          <Section title="7. Prohibited Conduct">
            <p>You may not:</p>
            <ul>
              <li>Use the Platform for any unlawful purpose.</li>
              <li>Post false, misleading, or fraudulent reviews.</li>
              <li>Circumvent platform fees by arranging services off-platform.</li>
              <li>Harass, threaten, or discriminate against other users.</li>
              <li>Attempt to reverse-engineer or interfere with the Platform.</li>
            </ul>
          </Section>

          <Section title="8. Pro Subscription (Handymen)">
            <p>The Tarea Pro subscription grants Handymen priority placement in search results and a PRO badge. Subscriptions are billed monthly and can be cancelled at any time; cancellation takes effect at the end of the current billing period. No refunds are issued for partial months.</p>
          </Section>

          <Section title="9. Intellectual Property">
            <p>All content on the Platform, including logos, design, and code, is owned by Tarea or its licensors. You retain ownership of content you upload (photos, descriptions) but grant Tarea a license to display it on the Platform.</p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>The Platform is provided "as is" without warranties of any kind. We do not warrant that the Platform will be uninterrupted, error-free, or that Handymen will meet your expectations.</p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>To the maximum extent permitted by law, Tarea's total liability to you for any claim arising from use of the Platform shall not exceed the fees you paid to Tarea in the 3 months preceding the claim.</p>
          </Section>

          <Section title="12. Dispute Resolution">
            <p>Any disputes between users should first be submitted through the Platform's dispute resolution feature. Disputes between users and Tarea shall be resolved by binding arbitration in the jurisdiction of Tarea's principal place of business, except that either party may seek injunctive relief in a court of competent jurisdiction.</p>
          </Section>

          <Section title="13. Changes to These Terms">
            <p>We may update these terms at any time. We will notify you of material changes via email 14 days in advance. Continued use of the Platform after that date constitutes acceptance.</p>
          </Section>

          <Section title="14. Governing Law">
            <p>These Terms are governed by the laws of the State of Florida, USA, without regard to conflict of law principles.</p>
          </Section>

          <Section title="15. Contact">
            <p>Questions about these Terms? Contact us at <a href="mailto:legal@tarea.app" className="text-tarea-sky hover:underline">legal@tarea.app</a>.</p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex gap-6 text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
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
