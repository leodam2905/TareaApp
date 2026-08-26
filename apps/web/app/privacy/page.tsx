import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Tarea",
  description: "How Tarea US LLC collects, uses, shares, and protects your personal information. CCPA & CPRA compliant.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-tarea-cream text-tarea-ink-muted">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-tarea-sky text-sm font-medium hover:underline">
            ← Back to Tarea
          </Link>
          <div className="mt-6 mb-2">
            <p className="text-tarea-sky text-xs font-semibold uppercase tracking-widest mb-2">taptarea.com</p>
            <h1 className="text-4xl font-extrabold text-tarea-ink">Privacy Policy</h1>
          </div>
          <p className="text-tarea-ink-subtle text-sm mt-2">Effective Date: August 19, 2026 &nbsp;|&nbsp; Version 2.1</p>
          <p className="text-tarea-ink-subtle text-sm">California Consumer Privacy Act (CCPA) &amp; CPRA Compliant</p>
        </div>

        <div className="space-y-10 prose-custom">

          <p>This Privacy Policy describes how <strong>Tarea US LLC</strong> collects, uses, shares, and protects your personal information, and explains your rights under California and federal law. Please read it carefully.</p>

          <Section title="1. Who We Are">
            <p>Tarea US LLC ("Tarea," "we," "us," or "our") operates the Tarea marketplace platform at taptarea.com and associated mobile applications. Tarea is a California limited liability company with its principal office at 400 N Oakland Avenue, Apt 209, Pasadena, California 91101.</p>
            <p>This Privacy Policy applies to all users of the Platform, including Customers (homeowners, renters, and businesses), Pros (independent service professionals), and visitors to our website.</p>
          </Section>

          <Section title="2. Information We Collect">
            <h3>2.1 — Information You Provide Directly</h3>
            <ul>
              <li><strong>Account registration:</strong> name, email address, phone number, password, profile photo.</li>
              <li><strong>Pro onboarding:</strong> business name, professional licenses, insurance documents, background check consent, service categories, service areas, and pricing.</li>
              <li><strong>Booking and transactions:</strong> service requests, booking details, payment information (processed by Stripe — Tarea does not store card numbers).</li>
              <li><strong>Communications:</strong> messages sent through the Platform between Customers and Pros, support tickets, and feedback.</li>
              <li><strong>Reviews and ratings:</strong> content submitted about Pros or Customers after completed bookings.</li>
              <li><strong>AI Diagnose submissions:</strong> photos of your home or property and written descriptions of an issue that you submit to the AI Diagnose feature.</li>
            </ul>
            <h3>2.2 — Information Collected Automatically</h3>
            <ul>
              <li><strong>Device information:</strong> IP address, browser type, operating system, device identifiers.</li>
              <li><strong>Usage data:</strong> pages viewed, features used, search queries, booking flow interactions, time spent on the Platform.</li>
              <li><strong>Location data:</strong> approximate location inferred from IP address; precise location if you grant permission via your device.</li>
              <li><strong>Cookies and tracking technologies:</strong> see Section 7 for details.</li>
            </ul>
            <h3>2.3 — Information from Third Parties</h3>
            <ul>
              <li>Background check results from third-party verification providers (Pros only).</li>
              <li>Payment processing data from Stripe, Inc.</li>
              <li>Identity verification data from third-party KYC providers (where applicable).</li>
              <li>Social login data if you choose to register via Google or Apple.</li>
            </ul>
          </Section>

          <Section title="3. Categories of Personal Information — CCPA Disclosure">
            <p>Tarea collects identifiers (name, email, phone, IP address), commercial information (booking and transaction history), geolocation data, internet activity, visual information (profile photos and photos you submit to AI Diagnose), and professional information (Pros only). We collect this information to operate the Platform, process bookings and payments, verify Pros, ensure safety, and improve our services.</p>
            <p><strong>Tarea does not sell personal information to third parties.</strong> Tarea does not share personal information for cross-context behavioral advertising without your explicit consent.</p>
          </Section>

          <Section title="4. How We Use Your Information">
            <h3>4.1 — To Provide and Operate the Platform</h3>
            <ul>
              <li>Create and manage your account.</li>
              <li>Process bookings, payments, and payouts.</li>
              <li>Match Customers with Pros based on location, availability, and service category.</li>
              <li>Facilitate communications between Customers and Pros.</li>
              <li>Process refunds, cancellations, and disputes.</li>
              <li>Analyze photos and descriptions you submit to AI Diagnose in order to suggest a service category and urgency level.</li>
            </ul>
            <h3>4.2 — To Verify and Ensure Safety</h3>
            <ul>
              <li>Conduct background checks and license verification for Pros.</li>
              <li>Detect and prevent fraud, abuse, and unauthorized access.</li>
              <li>Investigate complaints and disputes between users.</li>
              <li>Comply with legal obligations, court orders, and law enforcement requests.</li>
            </ul>
            <h3>4.3 — To Improve the Platform</h3>
            <ul>
              <li>Analyze usage patterns to improve features and user experience.</li>
              <li>Conduct internal research, testing, and analytics.</li>
              <li>Develop new services and platform features.</li>
            </ul>
            <h3>4.4 — To Communicate with You</h3>
            <ul>
              <li>Send booking confirmations, reminders, and receipts.</li>
              <li>Notify you of updates to these Terms or the Privacy Policy.</li>
              <li>Respond to customer support inquiries.</li>
              <li>Send promotional communications (only with your consent — you may opt out at any time).</li>
            </ul>
            <h3>4.5 — SMS / Text Messaging</h3>
            <p>With your consent, Tarea sends recurring SMS text messages for: (a) one-time verification codes (OTP) to secure your account; (b) booking confirmations, status updates, and appointment reminders; and (c) other service-related notifications. You provide your mobile number and consent to receive these messages when you create an account or log in to Tarea.</p>
            <p>Message frequency varies based on your activity. Message and data rates may apply. Reply <strong>STOP</strong> to any message to opt out at any time, or reply <strong>HELP</strong> for assistance. Opting out of SMS does not affect the email versions of these notifications.</p>
            <p><strong>No mobile information (including your phone number) or SMS opt-in and consent data is shared with third parties or affiliates for marketing or promotional purposes.</strong> Text-messaging originator opt-in data and consent are never sold or shared with any third party. We disclose your mobile number only to the messaging providers (such as Twilio) strictly necessary to deliver these messages.</p>
          </Section>

          <Section title="5. How We Share Your Information">
            <p>We do not sell your personal information. We share your information only in the following limited circumstances:</p>
            <h3>5.1 — With Other Users</h3>
            <p>When a booking is made, we share limited profile information between the Customer and Pro to facilitate the service — such as name, contact information, service address, and booking details. This sharing is limited to what is necessary to complete the transaction.</p>
            <h3>5.2 — With Service Providers</h3>
            <p>We share information with vetted third-party service providers who assist us in operating the Platform, subject to contractual obligations to protect your data:</p>
            <ul>
              <li>Stripe, Inc. — payment processing and payouts.</li>
              <li>Background check providers — Pro verification (Pros only).</li>
              <li>Cloud hosting and infrastructure providers.</li>
              <li>Analytics providers (anonymized/aggregated data only).</li>
              <li>Customer support software providers.</li>
              <li>Anthropic PBC — AI processing for the AI Diagnose feature.</li>
            </ul>
            <p>When you use AI Diagnose, the photo and description you submit are transmitted to our AI provider solely to generate your result. Under our agreement with that provider, your submissions are not used to train their models. Tarea does not share your name, contact details, or address with the AI provider as part of this request.</p>
            <h3>5.3 — For Legal Compliance</h3>
            <p>We may disclose information when required by law, legal process, or government request, including to comply with a subpoena, court order, or regulatory investigation. We will notify you of such requests where legally permitted.</p>
            <h3>5.4 — Business Transfers</h3>
            <p>In the event of a merger, acquisition, or sale of all or substantially all of Tarea's assets, your information may be transferred to the successor entity. We will notify you of any such transfer and your options under applicable law.</p>
            <h3>5.5 — With Your Consent</h3>
            <p>We may share your information for any other purpose with your explicit prior consent.</p>
          </Section>

          <Section title="6. Your California Privacy Rights — CCPA / CPRA">
            <p>If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA), effective January 1, 2023:</p>
            <ul>
              <li><strong>Right to Know (Cal. Civ. Code § 1798.110):</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you, the sources, our business purpose, and the categories of third parties with whom we share it.</li>
              <li><strong>Right to Delete (Cal. Civ. Code § 1798.105):</strong> You may request deletion of your personal information, subject to certain exceptions (such as completing a transaction or complying with a legal obligation).</li>
              <li><strong>Right to Correct (Cal. Civ. Code § 1798.106):</strong> You may request correction of inaccurate personal information we maintain about you.</li>
              <li><strong>Right to Opt Out of Sale or Sharing:</strong> Tarea does not sell personal information and does not share it for cross-context behavioral advertising. You may contact us to confirm our practices at any time.</li>
              <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> You may direct us to limit use and disclosure of your sensitive personal information to what is necessary to perform the requested services.</li>
              <li><strong>Right to Non-Discrimination (Cal. Civ. Code § 1798.125):</strong> We will not deny services, charge different prices, or provide a different quality of service as a result of exercising your rights.</li>
            </ul>
            <p>To submit a privacy rights request, email <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a> with subject line <strong>"California Privacy Rights Request"</strong>. We will acknowledge receipt within 10 business days and respond within 45 days as required by the CCPA. You may also designate an authorized agent to make a request on your behalf by providing written authorization.</p>
          </Section>

          <Section title="7. Cookies and Tracking Technologies">
            <p>Tarea uses cookies and similar tracking technologies to operate and improve the Platform:</p>
            <ul>
              <li><strong>Essential cookies:</strong> required for authentication and platform functionality. Cannot be disabled.</li>
              <li><strong>Analytics cookies:</strong> help us understand usage patterns (anonymized). You may opt out via browser settings.</li>
              <li><strong>Marketing cookies:</strong> only used with your explicit consent.</li>
            </ul>
            <p>You can control cookies through your browser settings. Disabling certain cookies may affect Platform functionality. For California residents, our use of analytics cookies does not constitute a "sale" of personal information under the CCPA.</p>
          </Section>

          <Section title="8. Data Retention">
            <ul>
              <li><strong>Account information:</strong> retained for the duration of your account and for 3 years after account closure.</li>
              <li><strong>Transaction records:</strong> retained for 7 years for tax and accounting purposes.</li>
              <li><strong>Background check data (Pros):</strong> retained for 5 years or as required by applicable law.</li>
              <li><strong>Communications and support records:</strong> retained for 3 years.</li>
              <li><strong>Analytics data:</strong> retained in anonymized form indefinitely; identifiable data retained for 2 years.</li>
              <li><strong>AI Diagnose photos and descriptions:</strong> processed to generate your result and not stored by Tarea after the request completes.</li>
            </ul>
            <p>Upon a verified deletion request, we will delete or anonymize your personal information within 45 days, subject to applicable legal exceptions.</p>
          </Section>

          <Section title="9. Data Security">
            <p>We implement commercially reasonable technical, administrative, and physical safeguards including:</p>
            <ul>
              <li>Encryption of data in transit (TLS/SSL) and at rest.</li>
              <li>Access controls limiting employee access to personal information on a need-to-know basis.</li>
              <li>Regular security assessments and vulnerability testing.</li>
              <li>Incident response procedures for detecting and responding to data breaches.</li>
            </ul>
            <p>In the event of a data breach affecting your personal information, we will notify you and applicable regulatory authorities as required by California law (Cal. Civ. Code § 1798.29 and § 1798.82) within 72 hours of discovery where feasible.</p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>The Tarea Platform is not directed at children under the age of 13, and we do not knowingly collect personal information from children under 13. If we discover that we have inadvertently collected personal information from a child under 13, we will promptly delete it. Contact us at <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a> if you believe we have collected such information.</p>
            <p>Users between the ages of 13 and 18 may only use the Platform with the consent and supervision of a parent or legal guardian. By registering, users affirm that they are at least 18 years of age or have obtained required parental consent.</p>
          </Section>

          <Section title="11. Third-Party Links and Services">
            <p>The Platform may contain links to third-party websites or integrate with third-party services (such as Stripe for payments). This Privacy Policy does not apply to third-party sites or services. We encourage you to review the privacy policies of any third parties you interact with through the Platform. Tarea is not responsible for the privacy practices of third parties.</p>
          </Section>

          <Section title="12. Do Not Track Signals">
            <p>California law (Cal. Bus. &amp; Prof. Code § 22575) requires us to disclose how we respond to "Do Not Track" (DNT) signals. Currently, the Tarea Platform does not respond to DNT signals from web browsers because there is no industry-wide standard for how DNT signals should be interpreted. We will update this section if a standard is adopted.</p>
          </Section>

          <Section title="13. Changes to This Privacy Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by:</p>
            <ul>
              <li>Posting the updated policy at taptarea.com/privacy with an updated effective date.</li>
              <li>Sending an email notification to your registered email address at least 14 days before the changes take effect.</li>
            </ul>
            <p>Your continued use of the Platform after the effective date constitutes acceptance of the updated Privacy Policy.</p>
          </Section>

          <Section title="14. Contact Us — Privacy Inquiries">
            <ul>
              <li><strong>Company:</strong> Tarea US LLC</li>
              <li><strong>Email:</strong> <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a></li>
              <li><strong>Legal Email:</strong> <a href="mailto:legal@taptarea.com" className="text-tarea-sky hover:underline">legal@taptarea.com</a></li>
              <li><strong>Mailing Address:</strong> 400 N Oakland Avenue, Apt 209, Pasadena, California 91101</li>
              <li><strong>Phone:</strong> <a href="tel:+18005555555" className="text-tarea-sky hover:underline">+1 (800) 555-5555</a></li>
            </ul>
            <p>For California privacy rights requests, use subject line: <strong>"California Privacy Rights Request."</strong> We will acknowledge receipt within 10 business days.</p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-tarea-border space-y-2">
          <p className="text-tarea-ink-subtle text-xs">Document: Privacy Policy v2.1 &nbsp;|&nbsp; Effective: August 19, 2026 &nbsp;|&nbsp; Governed by CCPA, Cal. Civ. Code §§ 1798.100–1798.199 &nbsp;|&nbsp; Also compliant with CPRA, CalOPPA, COPPA</p>
          <div className="flex gap-6 text-sm text-tarea-ink-subtle">
            <Link href="/guarantee" className="hover:text-tarea-ink transition-colors">ZenTarea Guarantee</Link>
            <Link href="/terms" className="hover:text-tarea-ink transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-tarea-ink transition-colors">Back to Tarea</Link>
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
      <h2 className="text-lg font-bold text-tarea-ink mb-3">{title}</h2>
      <div className="prose-custom">{children}</div>
    </section>
  );
}
