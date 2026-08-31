// THE Independent Contractor Agreement. One copy, rendered everywhere.
//
// This text was previously JSX inside app/(handyman)/handyman/onboarding/page.tsx
// and existed nowhere else, so the Flutter app had no way to show it — the
// agreement step in the pro onboarding checklist had no screen to open, which
// meant no pro could complete onboarding in the app at all.
//
// Copying it into Dart would have fixed that and created a worse problem: two
// copies of a contract, where a legal edit to the web version leaves pros in
// the app signing a stale agreement. So the text lives here, the web page
// renders it, and GET /api/handyman/ica returns it for the app.
//
// RULES FOR EDITING
//  - This is a legal document. Change wording only on instruction from counsel.
//  - Do NOT translate it. The app ships in en/fr/es/ar, but this agreement is
//    governed by California law and its arbitration, PAGA and liability clauses
//    are drafted in English. A machine translation is not the contract.
//  - Bump AGREEMENT_VERSION on any substantive change, so a re-acceptance can
//    be required later and it is possible to tell which text somebody signed.

import { CUSTOMER_FEE_RATE } from "./fees";

export const AGREEMENT_VERSION = "2026-08-31";

export type IcaBlock =
  | { kind: "p"; lead?: string; text: string }
  /**
   * Rendered uppercase — the clauses that must stand out legally.
   * tone "warn" is the amber acceptance notice; the default is the grey
   * treatment used for the liability and class-waiver clauses.
   */
  | { kind: "caps"; lead?: string; text: string; tone?: "warn" }
  /** A sub-heading inside a section, e.g. "(A) Freedom from Control — Test A:" */
  | { kind: "label"; text: string }
  | { kind: "bullets"; items: { lead?: string; text: string }[] };

export interface IcaSection {
  number: number;
  heading: string;
  blocks: IcaBlock[];
}

export interface IcaDocument {
  version: string;
  title: string;
  subtitle: string;
  parties: { heading: string; rows: { lead: string; text: string }[]; note: string };
  preamble: IcaBlock[];
  sections: IcaSection[];
  execution: {
    heading: string;
    note: string;
    signatureName: string;
    signatureTitle: string;
    signatureNote: string;
    footer: string;
  };
}

// The fee the contract states is the fee the platform charges, by construction.
// Spelling it out as a literal is how §4.1 came to promise something the code
// did not do; a signed agreement that misstates the rate is worse than none.
const FEE_PCT = `${+(CUSTOMER_FEE_RATE * 100).toFixed(2)}%`;

export const ICA: IcaDocument = {
  version: AGREEMENT_VERSION,
  title: "INDEPENDENT CONTRACTOR AGREEMENT",
  subtitle:
    "Platform Service Professional Agreement · Governing Law: State of California · AB5 Compliant",

  parties: {
    heading: "PARTIES",
    rows: [
      { lead: "Platform Company:", text: "Tarea US LLC, a California Limited Liability Company" },
      { lead: "Principal Office:", text: "400 N Oakland Avenue, Apt 209, Pasadena, California 91101" },
      { lead: "Email:", text: "support@taptarea.com" },
    ],
    note:
      "AND the Pro whose name, business information, and email address are associated with the Tarea account accepting this Agreement electronically.",
  },

  preamble: [
    {
      kind: "p",
      text:
        'This Independent Contractor Agreement ("Agreement") is entered into as of the date the Pro electronically accepts through the Tarea platform onboarding process ("Effective Date").',
    },
    {
      kind: "caps",
      tone: "warn",
      text:
        "IMPORTANT: BY SIGNING OR ELECTRONICALLY ACCEPTING THIS AGREEMENT, THE PRO ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY ALL TERMS AND CONDITIONS HEREIN.",
    },
  ],

  sections: [
    {
      number: 1,
      heading: "Independent Contractor Status — AB5 Compliance",
      blocks: [
        {
          kind: "p",
          lead: "1.1 — Independent Contractor Relationship.",
          text:
            "The Pro is and shall at all times remain an independent contractor and not an employee, agent, partner, joint venturer, or franchisee of Tarea. This Agreement does not create an employment relationship of any kind. The Parties expressly intend to maintain an independent contractor relationship consistent with California AB5, California Labor Code §§ 3350–3371, and applicable federal law.",
        },
        {
          kind: "p",
          lead: "1.2 — ABC Test Compliance (Cal. Lab. Code § 2775).",
          text: "The Pro represents, warrants, and agrees as follows:",
        },
        { kind: "label", text: "(A) Freedom from Control — Test A:" },
        {
          kind: "bullets",
          items: [
            { text: "The Pro is free from Tarea's control and direction in the performance of services, both under this Agreement and in fact." },
            { text: "Tarea does not and shall not direct, supervise, or control the manner, method, means, or details of the Pro's services." },
            { text: "The Pro may accept or decline any job request without penalty, deactivation, or negative consequence of any kind." },
            { text: "Tarea may not require the Pro to maintain specific hours, minimum bookings, or minimum availability." },
            { text: "The Pro sets their own rates for each category of work. Tarea does not set, cap, or negotiate the price of the Pro's labor." },
          ],
        },
        { kind: "label", text: "(B) Work Outside Usual Course of Business — Test B:" },
        {
          kind: "bullets",
          items: [
            { text: "The Pro performs physical home services (plumbing, electrical, carpentry, painting, HVAC, landscaping, or other skilled trades)." },
            { text: "Tarea is a software technology company providing marketplace infrastructure — not a home services company." },
          ],
        },
        { kind: "label", text: "(C) Independently Established Trade — Test C:" },
        {
          kind: "bullets",
          items: [
            { text: "The Pro operates their own business, holds required professional licenses, maintains their own tools and equipment, and is available to serve multiple clients." },
            { text: "The Pro is free to perform the same services for other platforms, businesses, or clients without restriction by Tarea." },
          ],
        },
        {
          kind: "p",
          lead: "1.3 — No Employment Benefits.",
          text:
            "As an independent contractor, the Pro is not entitled to and will not receive: wages or salary from Tarea, workers' compensation, unemployment insurance, health or dental benefits, retirement or 401(k) plans, paid time off, sick leave, reimbursement for tools or expenses, or any other employment benefit required by California or federal law for employees.",
        },
        {
          kind: "p",
          lead: "1.4 — Tax Obligations.",
          text:
            "The Pro is solely responsible for all federal, state, and local taxes on earnings, including self-employment taxes. Tarea will issue IRS Form 1099-NEC for annual earnings of $600 or more. The Pro agrees to provide a completed IRS Form W-9 prior to receiving any payout.",
        },
      ],
    },
    {
      number: 2,
      heading: "Platform Access and Use",
      blocks: [
        {
          kind: "p",
          lead: "2.1 — Pro Autonomy.",
          text:
            "The Pro has complete autonomy to: set their own rates and pricing; define their own hours and availability; set their own service area; accept or decline any job request for any reason; use other platforms or direct channels simultaneously; and work for competitors with no exclusivity obligation to Tarea.",
        },
        {
          kind: "p",
          lead: "2.2 — Platform Rules.",
          text:
            "While retaining full autonomy over their work, the Pro agrees to: maintain required licenses and insurance; treat Customers professionally; accurately represent qualifications; not solicit Customers off-platform during this Agreement and for 12 months after termination; and comply with all applicable laws. Compliance with Platform rules is a condition of platform access only — not a condition of employment.",
        },
      ],
    },
    {
      number: 3,
      heading: "Licensing, Insurance, and Compliance",
      blocks: [
        {
          kind: "p",
          lead: "3.1 — Required Licenses.",
          text:
            "The Pro warrants they hold all required licenses including: a California CSLB license for work valued at $1,000 or more in labor and materials combined (Cal. Bus. & Prof. Code §§ 7028, 7048, as amended by AB 2622 effective January 1, 2025), and for any work requiring a building permit or forming part of a larger project regardless of value; any trade-specific license required by California or applicable municipality; and any local business license required where the Pro operates.",
        },
        {
          kind: "p",
          lead: "3.2 — Insurance Requirements.",
          text:
            "The Pro must maintain: General Liability Insurance (minimum $1,000,000 per occurrence / $2,000,000 aggregate); Commercial Auto Insurance if driving to job sites (minimum $100,000 per occurrence); Workers' Compensation if the Pro has their own employees (as required by California law). The Pro shall name Tarea US LLC as an additional insured on their general liability policy upon request. Failure to maintain required insurance is grounds for immediate suspension.",
        },
        {
          kind: "p",
          lead: "3.3 — Worker Classification.",
          text:
            "If the Pro employs or subcontracts any workers, the Pro — not Tarea — is solely responsible for properly classifying, compensating, and providing benefits to those workers in accordance with AB5 and applicable law.",
        },
      ],
    },
    {
      number: 4,
      heading: "Compensation and Payments",
      blocks: [
        {
          kind: "p",
          lead: "4.1 — Fee Structure.",
          text:
            `The Pro independently sets their own hourly rate for each category of work they offer, and earns 100% of the labor amount charged for a completed booking. Tarea deducts no commission from the Pro's earnings. Tarea is compensated by a Service Fee of ${FEE_PCT} charged to the Customer in addition to the Pro's rate. Materials purchased by the Pro and reimbursed by the Customer are passed through at cost and carry no Service Fee.`,
        },
        {
          kind: "p",
          lead: "4.2 — Payout Processing.",
          text:
            "Payouts are processed via Stripe Connect on a daily schedule following job completion and the expiry of any applicable customer confirmation period. The Pro must maintain a Stripe Connect account and comply with Stripe's Terms of Service. Actual arrival of funds is subject to Stripe's processing schedule and the Pro's bank.",
        },
        {
          kind: "p",
          lead: "4.3 — Fee Changes.",
          text:
            "Tarea may modify the platform fee upon 30 days' written notice. Continued use after notice constitutes acceptance. If the Pro does not accept, they may terminate this Agreement.",
        },
        {
          kind: "p",
          lead: "4.4 — Cancellation Compensation.",
          text:
            "If a Customer cancels a confirmed booking within 24 hours of the scheduled time, the Pro receives 50% of the agreed service rate as compensation.",
        },
        {
          kind: "p",
          lead: "4.5 — Rate Setting and Rate Changes.",
          text:
            "The Pro sets their own rate and may change it at any time. Tarea does not set, cap, negotiate, or require approval of the Pro's rate. A rate change applies only to bookings created after the change; a booking is priced at the Pro's rate in effect when the Customer agreed to it, and that rate is recorded with the booking.",
        },
        {
          kind: "p",
          lead: "4.6 — Estimated Service Time.",
          text:
            "Tarea may provide the Customer with an estimated service time for a job. That estimate is informational only. It does not oblige the Pro to work for any minimum period, does not limit the time the Pro may spend, and does not fix the Pro's compensation. Where a job requires more time than estimated, the Pro may request additional time, which is billed at the Pro's own rate and requires the Customer's approval before any additional amount is charged.",
        },
      ],
    },
    {
      number: 5,
      heading: "Tools, Equipment, and Expenses",
      blocks: [
        {
          kind: "p",
          text:
            "The Pro is solely responsible for providing all tools, equipment, vehicles, materials, and supplies necessary to perform services. Tarea shall not provide, reimburse, or subsidize any tools, equipment, or business expenses. The Pro's use of their own tools and equipment is a hallmark of independent contractor status under California law.",
        },
      ],
    },
    {
      number: 6,
      heading: "Intellectual Property",
      blocks: [
        {
          kind: "p",
          text:
            "All Tarea intellectual property remains Tarea's exclusive property. The Pro retains ownership of content uploaded to the Platform but grants Tarea a non-exclusive, royalty-free, worldwide license to display and use such content on the Platform and in promotional materials for as long as the Pro's account is active. Any physical work product created for Customers belongs to the Customer — not Tarea.",
        },
      ],
    },
    {
      number: 7,
      heading: "Confidentiality",
      blocks: [
        {
          kind: "p",
          text:
            "The Pro agrees to keep confidential all non-public information regarding Tarea's business, technology, Customer data, pricing algorithms, and trade secrets. This obligation survives termination for three (3) years. Confidential Information excludes information that is publicly known through no breach of this Agreement.",
        },
      ],
    },
    {
      number: 8,
      heading: "Indemnification and Liability",
      blocks: [
        {
          kind: "p",
          lead: "8.1 — Pro Indemnification.",
          text:
            "The Pro shall indemnify, defend, and hold harmless Tarea from any claims arising out of: the Pro's performance of services; breach of this Agreement; any claim the Pro is an employee of Tarea; any injury or property damage caused by the Pro; failure to maintain required licenses or insurance; or misclassification of the Pro's own workers.",
        },
        {
          kind: "caps",
          lead: "8.2 — Limitation of Tarea's Liability.",
          text:
            "TO THE MAXIMUM EXTENT PERMITTED BY CALIFORNIA LAW, TAREA'S TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL PLATFORM FEES PAID TO THE PRO IN THE THREE (3) MONTHS PRECEDING THE CLAIM. TAREA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.",
        },
        {
          kind: "p",
          lead: "8.3 — No Guarantee of Work.",
          text:
            "Tarea makes no guarantee of the volume, frequency, or value of job requests the Pro will receive through the Platform.",
        },
      ],
    },
    {
      number: 9,
      heading: "Term and Termination",
      blocks: [
        {
          kind: "p",
          lead: "9.1 — Term.",
          text: "This Agreement begins on the Effective Date and continues until terminated by either Party.",
        },
        {
          kind: "p",
          lead: "9.2 — Termination by Pro.",
          text:
            "The Pro may terminate at any time by written notice to support@taptarea.com and deactivating their account. Termination does not relieve the Pro of obligations for services already booked.",
        },
        {
          kind: "p",
          lead: "9.3 — Termination by Tarea.",
          text:
            "Tarea may suspend or terminate the Pro's access at any time for: violation of this Agreement or Terms of Service; failure to maintain licenses or insurance; repeated low ratings or Customer complaints; fraudulent, abusive, or illegal conduct; or any action creating legal, reputational, or safety risk. Deactivation does not constitute termination of employment — no such relationship exists.",
        },
        {
          kind: "p",
          lead: "9.4 — Effect of Termination.",
          text:
            "Upon termination: the Pro's platform access immediately ceases; outstanding payouts for completed services will be processed within the standard window; and confidentiality, indemnification, non-solicitation, and dispute resolution obligations survive.",
        },
      ],
    },
    {
      number: 10,
      heading: "Non-Solicitation",
      blocks: [
        {
          kind: "p",
          text:
            "During this Agreement and for twelve (12) months following termination, the Pro agrees not to directly solicit Customers introduced through Tarea to transact outside the Platform for the same or similar services. This is not a non-compete — the Pro may freely offer services through other channels to independently obtained customers.",
        },
      ],
    },
    {
      number: 11,
      heading: "Dispute Resolution, Arbitration, and PAGA Waiver",
      blocks: [
        {
          kind: "p",
          lead: "11.1 — Informal Resolution.",
          text:
            "The Parties agree to attempt in good faith to resolve any dispute for thirty (30) days before initiating formal proceedings.",
        },
        {
          kind: "p",
          lead: "11.2 — Binding Arbitration.",
          text:
            "Any unresolved dispute shall be resolved by final and binding individual arbitration administered by JAMS or AAA in Los Angeles County, California, applying California law.",
        },
        {
          kind: "caps",
          lead: "11.3 — Class and Collective Action Waiver.",
          text:
            "THE PRO WAIVES THE RIGHT TO PARTICIPATE IN ANY CLASS ACTION, COLLECTIVE ACTION, CLASS ARBITRATION, OR REPRESENTATIVE PROCEEDING. ALL DISPUTES MUST BE BROUGHT INDIVIDUALLY.",
        },
        {
          kind: "p",
          lead: "11.4 — PAGA Waiver.",
          text:
            "To the fullest extent permitted by California law, the Pro waives any right to bring a PAGA representative action (Labor Code § 2698 et seq.) on behalf of others. Any individual PAGA claim not subject to waiver shall be litigated in a California court, with all other claims remaining in arbitration.",
        },
      ],
    },
    {
      number: 12,
      heading: "Governing Law and Jurisdiction",
      blocks: [
        {
          kind: "p",
          text:
            "This Agreement is governed by California law. Any claims not subject to arbitration shall be brought in the state or federal courts of Los Angeles County, California.",
        },
      ],
    },
    {
      number: 13,
      heading: "General Provisions",
      blocks: [
        {
          kind: "bullets",
          items: [
            { lead: "Entire Agreement:", text: "This Agreement together with Tarea's Terms of Service and Privacy Policy is the entire agreement between the Parties." },
            { lead: "Amendment:", text: "Tarea may amend upon 30 days' written notice. Continued use constitutes acceptance." },
            { lead: "Severability:", text: "If any provision is held invalid, remaining provisions continue in full force." },
            { lead: "Electronic Signatures:", text: "Electronic acceptance has the same legal effect as a handwritten signature under the California Uniform Electronic Transactions Act (Cal. Civ. Code § 1633.1 et seq.) and the federal E-SIGN Act." },
            { lead: "Notices:", text: "Notices to Tarea shall be sent to support@taptarea.com." },
          ],
        },
      ],
    },
  ],

  execution: {
    heading: "EXECUTION",
    note:
      'By clicking "Sign & Continue" below, you electronically sign this Agreement on behalf of yourself or your business entity. Your electronic signature, IP address, and timestamp will be recorded as legally binding evidence of your acceptance.',
    signatureName: "Debohi Jean Jacques Dah",
    signatureTitle: "Debohi Jean Jacques Dah — Chief Executive Officer, Tarea US LLC",
    signatureNote: "Signed electronically on behalf of Tarea US LLC",
    footer: "© 2026 Tarea US LLC · 400 N Oakland Ave, Apt 209, Pasadena, CA 91101 · legal@taptarea.com",
  },
};
