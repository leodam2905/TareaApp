import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Your Account – Tarea",
  description: "How to request deletion of your Tarea account and associated personal data.",
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-tarea-ink text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-tarea-sky text-sm font-medium hover:underline">
            ← Back to Tarea
          </Link>
          <div className="mt-6 mb-2">
            <p className="text-tarea-sky text-xs font-semibold uppercase tracking-widest mb-2">taptarea.com</p>
            <h1 className="text-4xl font-extrabold text-white">Delete Your Account</h1>
          </div>
          <p className="text-slate-500 text-sm mt-2">Request deletion of your Tarea account and associated personal data.</p>
        </div>

        <div className="space-y-10 prose-custom">

          <p>
            You can request deletion of your <strong>Tarea</strong> account and the personal data
            associated with it at any time. This page explains how to make that request, what data is
            deleted, what we may retain, and how long it takes.
          </p>

          <Section title="How to request account deletion">
            <p>
              Send a deletion request from the email address registered to your Tarea account to{" "}
              <a href="mailto:support@taptarea.com?subject=Account%20Deletion%20Request" className="text-tarea-sky hover:underline">support@taptarea.com</a>{" "}
              with the subject line <strong>"Account Deletion Request."</strong> Please include the full
              name on your account so we can locate it.
            </p>
            <p>
              We verify that the request comes from the account owner before processing it, to protect
              your account from unauthorized deletion. You will receive a confirmation once your account
              has been deleted.
            </p>
          </Section>

          <Section title="What data is deleted">
            <p>When your deletion request is processed, we permanently remove:</p>
            <ul>
              <li>Your account profile — name, email address, phone number, and password.</li>
              <li>Your address and saved location data.</li>
              <li>Profile and portfolio photos, and any verification documents you uploaded.</li>
              <li>In-app messages and your booking history tied to your account.</li>
              <li>Reviews, favorites, and other content associated with your account.</li>
              <li>Your device push-notification token.</li>
            </ul>
          </Section>

          <Section title="What we retain, and why">
            <p>
              For legal, tax, fraud-prevention, and accounting reasons, we may retain a limited set of
              records after deletion, as permitted by law:
            </p>
            <ul>
              <li>
                <strong>Transaction and payment records</strong> required for tax and financial
                compliance (handled by our payment processor, Stripe — Tarea does not store card
                numbers). These are retained for the period required by applicable law.
              </li>
              <li>
                <strong>Records needed to resolve disputes</strong> or enforce our agreements, and to
                comply with legal obligations.
              </li>
            </ul>
            <p>
              Retained records are minimized and, where possible, anonymized so they are no longer
              linked to your identity.
            </p>
          </Section>

          <Section title="How long it takes">
            <p>
              We process verified deletion requests within <strong>30 days</strong> and send a
              confirmation to your email once complete. Backups containing residual data are purged on
              our regular backup rotation cycle.
            </p>
          </Section>

          <Section title="Questions">
            <p>If you have questions about deleting your account or your data, contact us:</p>
            <ul>
              <li><strong>Company:</strong> Tarea US LLC</li>
              <li><strong>Email:</strong> <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a></li>
              <li><strong>Mailing Address:</strong> 400 N Oakland Avenue, Apt 209, Pasadena, California 91101</li>
            </ul>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 space-y-2">
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-white transition-colors">Back to Tarea</Link>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .prose-custom p { margin-bottom: 12px; line-height: 1.7; }
        .prose-custom ul { list-style: disc; padding-left: 20px; margin: 8px 0 12px; }
        .prose-custom li { margin-bottom: 6px; }
        .prose-custom strong { color: #e2e8f0; font-weight: 600; }
        .prose-custom h3 { color: #cbd5e1; font-weight: 600; font-size: 0.95rem; margin: 16px 0 8px; }
      ` }} />
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
