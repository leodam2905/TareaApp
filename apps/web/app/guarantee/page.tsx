import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZenTarea Guarantee – Tarea",
  description:
    "ZenTarea is Tarea's capped reimbursement guarantee — up to $5,000 for property damage caused by a Pro on a job booked and paid through Tarea. ZenTarea is not insurance.",
};

export default function GuaranteePage() {
  return (
    <div className="day-only min-h-screen bg-tarea-cream text-tarea-ink-muted">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-tarea-sky text-sm font-medium hover:underline">
            ← Back to Tarea
          </Link>
          <div className="mt-6 mb-2">
            <p className="text-tarea-sky text-xs font-semibold uppercase tracking-widest mb-2">taptarea.com</p>
            <h1 className="text-4xl font-extrabold text-tarea-ink">The ZenTarea Guarantee</h1>
          </div>
          <p className="text-tarea-ink-muted mt-3 text-lg">
            Book with peace of mind. If a Pro damages your property on a job booked and paid through
            Tarea, ZenTarea reimburses you up to <strong className="text-tarea-ink">$5,000</strong>.
          </p>
          <p className="text-red-700 text-sm mt-4">Effective Date: August 8, 2026 &nbsp;|&nbsp; Version 1.0</p>
          <p className="text-red-700 text-sm">Governing Law: State of California</p>

          <div className="mt-6 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl">
            <p className="text-amber-300 text-xs font-semibold leading-relaxed">
              IMPORTANT: ZENTAREA IS NOT INSURANCE. IT IS NOT A CONTRACT OF INSURANCE, AN INSURANCE
              POLICY, A SURETY BOND, OR A WARRANTY. TAREA IS NOT AN INSURER AND IS NOT LICENSED TO
              SELL INSURANCE. ZENTAREA IS A LIMITED, DISCRETIONARY REIMBURSEMENT PROGRAM OFFERED BY
              TAREA US LLC AS A GOODWILL BENEFIT, AND IT APPLIES ONLY AFTER ALL OTHER SOURCES OF
              RECOVERY HAVE BEEN EXHAUSTED.
            </p>
          </div>
        </div>

        <div className="space-y-10 prose-custom">

          <Section title="1. What ZenTarea Is">
            <p>ZenTarea is a limited reimbursement program offered by <strong>Tarea US LLC</strong> (&quot;Tarea&quot;) to Customers who book and pay for services through the Tarea platform. If a Pro causes accidental physical damage to your property while performing a job booked and paid through Tarea, ZenTarea may reimburse you for the reasonable cost of repair or replacement, up to a maximum of <strong>$5,000 per job</strong>.</p>
            <p>ZenTarea is funded by Tarea. It costs you nothing extra — it is included for every Customer on every eligible job.</p>
            <p><strong>ZenTarea is not insurance.</strong> It does not replace your homeowner&apos;s, renter&apos;s, or business insurance, and it does not replace the Pro&apos;s own liability insurance. It is a last-resort benefit that applies only to amounts you cannot recover elsewhere.</p>
          </Section>

          <Section title="2. Who Is Covered">
            <p>ZenTarea is available to a Customer if <strong>all</strong> of the following are true:</p>
            <ul>
              <li>The job was booked through the Tarea platform and paid in full through Tarea. Jobs arranged, negotiated, or paid outside the platform — including cash, direct transfer, or any off-platform payment — are never eligible.</li>
              <li>You are the Customer who booked the job, and the damaged property is at the service address on the booking.</li>
              <li>Your Tarea account is in good standing and not suspended.</li>
              <li>You reported the damage within the deadline in Section 5.</li>
            </ul>
          </Section>

          <Section title="3. What ZenTarea Covers">
            <p>Subject to the exclusions in Section 4 and the $5,000 cap, ZenTarea may reimburse the reasonable cost to repair or, where repair is not practical, replace Customer property that was accidentally physically damaged by a Pro in the course of performing an eligible job.</p>
            <p>Reimbursement is calculated at <strong>actual cash value</strong> — the cost to repair or replace with an item of comparable kind, age, and condition, less depreciation. ZenTarea does not pay replacement-cost-new for used property.</p>
            <p>Tarea may, at its discretion, arrange and pay for the repair directly instead of reimbursing you.</p>
          </Section>

          <Section title="4. What ZenTarea Does Not Cover">
            <p>ZenTarea does <strong>not</strong> cover any of the following:</p>
            <ul>
              <li><strong>Bodily injury</strong> of any kind, to any person, including you, your household, the Pro, or any third party.</li>
              <li><strong>Poor workmanship, incomplete work, or dissatisfaction with results.</strong> Quality disputes are handled through Tarea&apos;s dispute resolution process, not ZenTarea.</li>
              <li><strong>Theft, disappearance, or loss</strong> of property, whether or not attributed to a Pro.</li>
              <li><strong>Pre-existing damage</strong>, normal wear and tear, gradual deterioration, rust, corrosion, mold, pests, or defects present before the job began.</li>
              <li><strong>Damage that was a necessary and foreseeable part of the requested work</strong> — for example, opening a wall you asked to have opened.</li>
              <li><strong>Cash, securities, jewelry, precious metals, furs, collectibles, fine art, antiques, and other items of unusual value.</strong></li>
              <li><strong>Data, software, digital assets, records, and documents.</strong></li>
              <li><strong>Motor vehicles, watercraft, aircraft, trailers,</strong> and their contents.</li>
              <li><strong>Pets, livestock, plants, and living things.</strong></li>
              <li><strong>Real property you do not own or lawfully occupy</strong>, and any property outside the service address on the booking.</li>
              <li><strong>Indirect, incidental, consequential, punitive, or economic losses</strong> — including lost income, loss of use, hotel or relocation costs, delay, inconvenience, or diminution in value.</li>
              <li><strong>Damage caused by you</strong>, your household, guests, other contractors, or anyone other than the assigned Pro.</li>
              <li><strong>Intentional, reckless, criminal, or fraudulent acts</strong> by any party, including the Pro. Such acts are matters for law enforcement and the Pro&apos;s own liability.</li>
              <li><strong>Acts of nature and events outside the job</strong> — flood, earthquake, fire not caused by the Pro, storm, power surge, war, or civil unrest.</li>
              <li>Any amount <strong>recoverable from any other source</strong>, as described in Section 6.</li>
            </ul>
          </Section>

          <Section title="5. Deadlines — Read This First">
            <p>ZenTarea has strict deadlines. Missing one makes a claim ineligible.</p>
            <ul>
              <li>You must report the damage to Tarea in writing within <strong>14 calendar days</strong> of the date the job was completed or cancelled, whichever is earlier.</li>
              <li>You must submit all requested documentation within <strong>30 calendar days</strong> of reporting.</li>
              <li>You must not repair, replace, alter, or discard the damaged property before Tarea has had a reasonable opportunity to inspect it or review your documentation, except to prevent further damage.</li>
            </ul>
            <p>Report a claim at <strong>support@taptarea.com</strong> with your booking reference.</p>
          </Section>

          <Section title="6. ZenTarea Pays Last">
            <p>ZenTarea is <strong>secondary to every other source of recovery</strong>. Before ZenTarea pays anything, you must first pursue, and exhaust, all of the following that apply:</p>
            <ul>
              <li>The Pro&apos;s own general liability insurance.</li>
              <li>Your homeowner&apos;s, renter&apos;s, condominium, or business insurance.</li>
              <li>Any manufacturer&apos;s warranty, home warranty, or service contract.</li>
              <li>Any other insurance, indemnity, guarantee, or contractual right available to you.</li>
            </ul>
            <p>ZenTarea may reimburse only the portion of a covered loss that remains unpaid after those sources have responded, including an unmet deductible, and only up to the $5,000 cap. If another source denies your claim, you must provide the written denial.</p>
            <p>Tarea does not require you to sue the Pro before making a ZenTarea claim.</p>
          </Section>

          <Section title="7. The $5,000 Cap">
            <p><strong>$5,000 is the maximum ZenTarea will pay for any single job</strong>, regardless of the number of damaged items, the number of Pros, or the actual value of the loss. Where a single event affects more than one job, or a series of related events arises from one cause, all of it is treated as one job for the purpose of this cap.</p>
            <p>The cap is an absolute ceiling, not a deductible or an estimate of typical payment. Most claims resolve well below it.</p>
          </Section>

          <Section title="8. How a Claim Works">
            <ul>
              <li><strong>Report.</strong> Email support@taptarea.com within 14 days with the booking reference, a description of what happened, and photographs.</li>
              <li><strong>Document.</strong> Tarea will request what it needs — photographs, a repair or replacement estimate from a qualified third party, proof of ownership and value, and the outcome of any other claim under Section 6.</li>
              <li><strong>Review.</strong> Tarea will review the claim and may contact the Pro, request an inspection, or ask for more information. Tarea aims to decide within 30 days of receiving a complete submission.</li>
              <li><strong>Decision.</strong> Tarea will notify you of the outcome in writing. If approved, payment is issued to the Customer of record by the original payment method or another method Tarea selects.</li>
            </ul>
          </Section>

          <Section title="9. Your Obligations">
            <p>To remain eligible, you must:</p>
            <ul>
              <li>Provide complete and truthful information. Any misrepresentation, exaggeration, or fabricated documentation voids the claim entirely and may result in account termination and referral to law enforcement.</li>
              <li>Cooperate reasonably with Tarea&apos;s review, including inspection of the property and the damaged item.</li>
              <li>Take reasonable steps to prevent further damage after the incident.</li>
              <li>Assign to Tarea, upon payment, your rights of recovery against the Pro or any other responsible party up to the amount paid, and cooperate with Tarea in pursuing them.</li>
            </ul>
          </Section>

          <Section title="10. Relationship to the Pro and to Tarea's Role">
            <p>Pros are independent contractors, not employees or agents of Tarea. Tarea does not perform services, supervise work, or control how a Pro performs a job. Paying a ZenTarea claim is not an admission that Tarea is liable for the loss, that the Pro is an agent of Tarea, or that Tarea is responsible for the Pro&apos;s conduct.</p>
            <p>Nothing in ZenTarea relieves a Pro of responsibility for damage they cause. Tarea may seek reimbursement from the Pro and may suspend or remove Pros whose conduct results in claims.</p>
          </Section>

          <Section title="11. Discretion, Changes, and Withdrawal">
            <p>ZenTarea is offered at Tarea&apos;s discretion as a benefit of using the platform. It is not a contractual entitlement, and it creates no third-party rights. Tarea may modify, suspend, or discontinue ZenTarea at any time. The version of these terms in effect on the date the job was booked governs that job.</p>
            <p>Tarea&apos;s determination of eligibility, coverage, valuation, and amount is final, subject to the dispute resolution provisions of the <Link href="/terms" className="text-tarea-sky hover:underline">Terms of Service</Link>.</p>
          </Section>

          <Section title="12. Definitions">
            <ul>
              <li><strong>Job</strong> — a single booking made and paid through the Tarea platform.</li>
              <li><strong>Pro</strong> — the independent service professional assigned to and accepted for that booking.</li>
              <li><strong>Customer</strong> — the Tarea account holder who booked and paid for the job.</li>
              <li><strong>Actual cash value</strong> — repair or replacement cost with comparable property of like kind, age, and condition, less depreciation.</li>
            </ul>
          </Section>

          <Section title="13. Questions">
            <p>Email <strong>support@taptarea.com</strong>. ZenTarea is provided by Tarea US LLC, a California limited liability company, and is governed by California law. These terms supplement, and do not replace, the <Link href="/terms" className="text-tarea-sky hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-tarea-sky hover:underline">Privacy Policy</Link>.</p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-tarea-border flex flex-wrap gap-6 text-sm text-red-700">
          <Link href="/terms" className="hover:text-tarea-ink transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-tarea-ink transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-tarea-ink transition-colors">Home</Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .prose-custom p { margin-bottom: 12px; line-height: 1.7; }
        .prose-custom ul { list-style: disc; padding-left: 20px; margin: 8px 0 12px; }
        .prose-custom li { margin-bottom: 6px; }
        .prose-custom strong { color: var(--text-primary); font-weight: 600; }
        .prose-custom h3 { color: var(--text-primary); font-weight: 600; font-size: 0.95rem; margin: 16px 0 8px; }
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
