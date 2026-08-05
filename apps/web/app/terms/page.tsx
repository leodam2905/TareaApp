import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service – Tarea",
  description: "The terms that govern your use of the Tarea handyman marketplace. California law, AB5 compliant.",
};

export default function TermsPage() {
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
            <h1 className="text-4xl font-extrabold text-white">Terms of Service</h1>
          </div>
          <p className="text-slate-500 text-sm mt-2">Effective Date: May 12, 2026 &nbsp;|&nbsp; Version 2.0</p>
          <p className="text-slate-500 text-sm">Governing Law: State of California</p>
          <div className="mt-4 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl">
            <p className="text-amber-300 text-xs font-semibold leading-relaxed">IMPORTANT: PLEASE READ THESE TERMS CAREFULLY BEFORE USING THE TAREA PLATFORM. BY CREATING AN ACCOUNT OR USING ANY PART OF THE PLATFORM, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE, DO NOT USE THE PLATFORM.</p>
          </div>
        </div>

        <div className="space-y-10 prose-custom">

          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the Tarea platform ("Platform"), including the website at taptarea.com, mobile applications, and all associated services, you agree to be bound by these Terms of Service ("Terms"), our Privacy Policy, and any additional terms applicable to specific features. These Terms constitute a legally binding agreement between you and <strong>Tarea US LLC</strong> ("Tarea," "we," "us," or "our"), a California limited liability company.</p>
            <p>If you are using the Platform on behalf of a business or organization, you represent that you have authority to bind that entity to these Terms.</p>
          </Section>

          <Section title="2. The Tarea Platform — Marketplace Technology Only">
            <p>Tarea operates exclusively as a technology marketplace platform. We provide software, booking infrastructure, payment processing, and communication tools that connect independent service professionals ("Pros") with homeowners, renters, and businesses ("Customers") seeking home repair, maintenance, and skilled trade services.</p>
            <p><strong>Tarea is a technology company — not a home services company.</strong> We do not provide home services, employ Pros, or act as a contractor, employer, staffing agency, or labor broker of any kind. Specifically:</p>
            <ul>
              <li>Tarea does not employ, supervise, direct, or control the work of any Pro.</li>
              <li>Tarea does not set the schedule, location, or method by which Pros perform services.</li>
              <li>Tarea does not guarantee the quality, safety, timeliness, or completion of any service performed by a Pro.</li>
              <li>Each Pro is an independent business owner who independently contracts with Customers through the Platform.</li>
              <li>Tarea's role is limited to facilitating introductions and transactions between Customers and Pros.</li>
            </ul>
            <p>All services listed on the Platform are offered by Pros who operate as independent contractors. Any booking made through the Platform constitutes a direct contract between the Customer and the Pro — not between the Customer and Tarea.</p>
          </Section>

          <Section title="3. Independent Contractor Status of Pros — California AB5 Compliance">
            <h3>3.1 — Classification</h3>
            <p>All Pros on the Tarea Platform are independent contractors, not employees of Tarea. This classification is made in accordance with California Assembly Bill 5 (AB5), the California Labor Code, and applicable federal law.</p>
            <h3>3.2 — Pro Autonomy</h3>
            <p>In accordance with AB5 and the ABC test, Pros on Tarea:</p>
            <ul>
              <li>Are free from Tarea's control and direction in connection with the performance of their services.</li>
              <li>Set their own rates, hours, availability, and service areas entirely at their own discretion.</li>
              <li>Are free to accept or decline any job request without penalty, deactivation, or negative consequence.</li>
              <li>Are free to perform services for competitors, other platforms, or independently, with no exclusivity requirement.</li>
              <li>Operate their own independent businesses, carry their own tools and equipment, and maintain their own professional licenses and insurance.</li>
              <li>Are engaged in an independently established trade, occupation, or business of the same nature as the services performed on the Platform.</li>
            </ul>
            <h3>3.3 — No Employment Relationship</h3>
            <p>Nothing in these Terms shall be construed to create an employment relationship, partnership, joint venture, agency relationship, franchise, or any other form of legal association other than that of independent contracting parties. Tarea shall not withhold taxes on behalf of Pros, provide workers' compensation or employment benefits, or direct the manner in which Pros perform their services.</p>
            <h3>3.4 — Pro Licensing and Insurance Requirements</h3>
            <p>Pros represent and warrant that they hold all required licenses (including any California CSLB license for work valued at $500 or more in labor and materials), carry general liability insurance of no less than $1,000,000 per occurrence, and comply with all applicable laws governing their trade.</p>
          </Section>

          <Section title="4. User Accounts">
            <ul>
              <li>You must be at least 18 years of age to create an account.</li>
              <li>You must provide accurate, complete, and current information at registration and keep it updated.</li>
              <li>You are solely responsible for all activity occurring under your account and for maintaining the confidentiality of your login credentials.</li>
              <li>You may not create an account on behalf of another person without their explicit authorization.</li>
              <li>Tarea reserves the right to suspend or terminate accounts that violate these Terms or applicable law.</li>
            </ul>
          </Section>

          <Section title="5. Bookings and Payments">
            <h3>5.1 — Pricing</h3>
            <p>Pros independently set their own service rates. Tarea does not set, control, or influence Pro pricing. The service price at checkout reflects the Pro's rate plus a Service &amp; Protection Fee.</p>
            <h3>5.2 — Platform Fee</h3>
            <p>Customers pay the Pro's service price plus a <strong>15% Service &amp; Protection Fee</strong>. Pros receive 90% of the agreed service price. Payouts are processed via Stripe Connect and subject to Stripe's Terms of Service.</p>
            <h3>5.3 — Payment Processing</h3>
            <p>All payments are processed by Stripe, Inc. Tarea does not store credit card or bank account information. By using the Platform, you also agree to <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer" className="text-tarea-sky hover:underline">Stripe's Terms of Service</a>.</p>
          </Section>

          <Section title="6. Cancellations and Refunds">
            <ul>
              <li><strong>Full refund:</strong> Cancel more than 24 hours before the scheduled service time.</li>
              <li><strong>50% refund:</strong> Cancel within 24 hours of the scheduled service time. The Pro receives 50% of their net fee as compensation.</li>
              <li>No refund is issued after a service has been marked as completed by both parties.</li>
              <li>Disputes regarding completed services must be submitted through the Platform's dispute resolution feature within 7 days of completion.</li>
            </ul>
          </Section>

          <Section title="7. Pro Conduct and Platform Rules">
            <p>Pros who register on the Platform agree to:</p>
            <ul>
              <li>Provide services in a professional, lawful, and workmanlike manner consistent with industry standards.</li>
              <li>Maintain all required licenses, permits, and insurance throughout their time on the Platform.</li>
              <li>Treat all Customers with professionalism, respect, and courtesy.</li>
              <li>Not solicit Customers to transact outside the Platform in order to circumvent platform fees.</li>
              <li>Not misrepresent their qualifications, experience, or the nature of services offered.</li>
              <li>Comply with all applicable federal, California, and local laws.</li>
            </ul>
            <p>Tarea reserves the right to remove a Pro from the Platform for violation of these rules, but such removal does not constitute termination of employment and creates no employment-related claims against Tarea.</p>
          </Section>

          <Section title="8. Customer Conduct">
            <p>Customers agree to:</p>
            <ul>
              <li>Provide accurate descriptions of the services needed and the conditions at the service location.</li>
              <li>Ensure the service location is safe and accessible for the Pro.</li>
              <li>Pay for completed services as agreed at booking.</li>
              <li>Treat all Pros with professionalism and respect.</li>
              <li>Not attempt to hire Pros outside the Platform to circumvent platform fees for a period of 12 months following an introduction made through the Platform.</li>
            </ul>
          </Section>

          <Section title="9. Prohibited Conduct">
            <p>All users are prohibited from:</p>
            <ul>
              <li>Using the Platform for any unlawful purpose or in violation of any applicable law.</li>
              <li>Posting false, misleading, fraudulent, or defamatory reviews or content.</li>
              <li>Circumventing platform fees by arranging services off-platform after a Tarea introduction.</li>
              <li>Harassing, threatening, discriminating against, or abusing any other user.</li>
              <li>Attempting to reverse-engineer, hack, scrape, or otherwise interfere with the Platform.</li>
              <li>Impersonating any person or entity or misrepresenting your affiliation with any person or entity.</li>
              <li>Using automated tools to access the Platform without Tarea's express written consent.</li>
            </ul>
          </Section>

          <Section title="10. Background Verification">
            <p>Tarea may facilitate third-party background verification checks on Pros as part of the onboarding process. These checks are performed by independent third-party providers, not by Tarea. The existence of a background verification does not create an employment relationship, constitute a guarantee or endorsement of any Pro's qualifications, or transfer liability for a Pro's actions from the Pro to Tarea.</p>
            <p>Customers are encouraged to independently verify Pro credentials, licenses, and insurance before engaging services for high-value or safety-critical work.</p>
          </Section>

          <Section title="11. Pro Subscription (Tarea Pro)">
            <p>The Tarea Pro subscription grants Pros priority placement in search results and a verified Pro badge. Subscriptions are billed monthly and may be cancelled at any time; cancellation takes effect at the end of the current billing period. No refunds are issued for partial months. The Pro subscription is a voluntary marketing tool and does not alter the independent contractor relationship between Tarea and Pros.</p>
          </Section>

          <Section title="12. Ratings and Reviews">
            <p>By submitting a review, you represent that it is truthful, based on your genuine experience, and does not violate any applicable law. Tarea reserves the right to remove reviews that violate these Terms or that are fraudulent, but is not obligated to do so. Tarea's decisions about ratings and search placement do not constitute employer direction or control over Pros.</p>
          </Section>

          <Section title="13. Intellectual Property">
            <p>All content on the Platform, including logos, design, code, text, graphics, and software, is owned by Tarea US LLC or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from Tarea's content without express written permission.</p>
            <p>You retain ownership of content you upload to the Platform (photos, descriptions, reviews) but grant Tarea a non-exclusive, royalty-free, worldwide license to display, reproduce, and distribute such content on the Platform and in promotional materials.</p>
          </Section>

          <Section title="14. California Privacy Rights — CCPA Disclosure">
            <p>Tarea collects identifiers, commercial information, professional information (Pros only), internet activity, and geolocation data to operate the Platform. <strong>Tarea does not sell personal information.</strong> California residents have the right to know, delete, correct, and limit use of their personal information. To exercise these rights, email <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a> with subject line <strong>"California Privacy Rights Request."</strong> See our full <Link href="/privacy" className="text-tarea-sky hover:underline">Privacy Policy</Link> for complete details.</p>
          </Section>

          <Section title="15. Disclaimers and Limitations of Liability">
            <p className="uppercase text-xs text-slate-400 leading-relaxed">THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. TAREA DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT PROS WILL MEET YOUR EXPECTATIONS.</p>
            <p className="uppercase text-xs text-slate-400 leading-relaxed mt-3">TO THE MAXIMUM EXTENT PERMITTED BY CALIFORNIA LAW, TAREA'S TOTAL LIABILITY TO YOU FOR ANY CLAIM SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES PAID BY YOU TO TAREA IN THE THREE (3) MONTHS PRECEDING THE CLAIM, OR (B) $100.00. TAREA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.</p>
          </Section>

          <Section title="16. Dispute Resolution, Arbitration, and PAGA Waiver">
            <h3>16.1 — Informal Resolution</h3>
            <p>Before initiating any formal dispute, you agree to contact Tarea at <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a> and attempt to resolve the dispute informally for at least thirty (30) days.</p>
            <h3>16.2 — Binding Arbitration</h3>
            <p>If informal resolution fails, any dispute arising out of or relating to these Terms shall be resolved by final and binding individual arbitration administered by JAMS under its Streamlined Arbitration Rules, or by the AAA under its Consumer Arbitration Rules. Arbitration shall take place in Los Angeles County, California, applying California law.</p>
            <h3>16.3 — Class Action Waiver</h3>
            <p className="uppercase text-xs text-slate-400 leading-relaxed">YOU AND TAREA EACH WAIVE THE RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS ACTION, CLASS ARBITRATION, OR REPRESENTATIVE PROCEEDING. ALL DISPUTES MUST BE BROUGHT IN YOUR INDIVIDUAL CAPACITY ONLY.</p>
            <h3>16.4 — PAGA Waiver (California)</h3>
            <p>To the fullest extent permitted by California law, you waive any right to bring a representative action under the California Private Attorneys General Act (Labor Code § 2698 et seq.) on behalf of other individuals. If any court determines this waiver is unenforceable, any PAGA claim shall be severed from arbitration and litigated in a California court, with all other claims remaining in arbitration.</p>
            <h3>16.5 — Injunctive Relief</h3>
            <p>Either party may seek injunctive or other equitable relief in any California court of competent jurisdiction to prevent irreparable harm or protect intellectual property rights.</p>
          </Section>

          <Section title="17. Governing Law and Jurisdiction">
            <p>These Terms are governed by and construed in accordance with the laws of the <strong>State of California</strong>, without regard to its conflict of law principles. Any dispute not subject to arbitration shall be submitted to the exclusive jurisdiction of the state and federal courts located in Los Angeles County, California.</p>
            <p>Your rights as a California consumer or worker under California law (including the CCPA, CPRA, California Labor Code, and California Business and Professions Code) shall not be diminished by these Terms.</p>
          </Section>

          <Section title="18. Changes to These Terms">
            <p>Tarea reserves the right to update or modify these Terms at any time. We will notify users of material changes by email at least fourteen (14) days before the changes take effect. Your continued use of the Platform after the effective date constitutes acceptance of the revised Terms. We maintain a version history at taptarea.com/terms.</p>
          </Section>

          <Section title="19. Termination">
            <p>Tarea may suspend or terminate your access to the Platform at any time, with or without cause or notice, including for violation of these Terms. You may terminate your account at any time by contacting <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a>. Termination of a Pro's account does not create any employment-related claims against Tarea, including claims for wrongful termination.</p>
            <p>Sections 2, 3, 13, 14, 15, 16, and 17 shall survive any termination of these Terms.</p>
          </Section>

          <Section title="20. Miscellaneous">
            <ul>
              <li><strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy and any additional terms, constitute the entire agreement between you and Tarea regarding the Platform.</li>
              <li><strong>Severability:</strong> If any provision is found invalid or unenforceable, the remaining provisions continue in full force and effect.</li>
              <li><strong>Waiver:</strong> Tarea's failure to enforce any provision shall not constitute a waiver of future enforcement rights.</li>
              <li><strong>No Assignment:</strong> You may not assign your rights under these Terms without Tarea's prior written consent. Tarea may assign these Terms without restriction.</li>
              <li><strong>Contact:</strong> For questions about these Terms, contact us at <a href="mailto:support@taptarea.com" className="text-tarea-sky hover:underline">support@taptarea.com</a> or <a href="mailto:legal@taptarea.com" className="text-tarea-sky hover:underline">legal@taptarea.com</a>.</li>
            </ul>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 space-y-2">
          <p className="text-slate-600 text-xs">Company: Tarea US LLC &nbsp;|&nbsp; Principal Office: 400 N Oakland Avenue, Apt 209, Pasadena, CA 91101 &nbsp;|&nbsp; Version 2.0 — Effective May 12, 2026</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
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
