import { prisma } from "@/lib/prisma";
import { handymanNet } from "@/lib/fees";

// A pro's annual earnings, in one definition.
//
// Two surfaces read this — the in-app report and the emailed CSV — and they
// must never disagree: a pro filing from the app screen and an accountant
// filing from the attachment have to arrive at the same numbers.
//
// COMPLETED only, by completedAt. Money is released to the pro at completion,
// so that is the date the earning belongs to; a job booked in December and
// finished in January is next year's income.

/** IRS threshold for a 1099-NEC. Below it, no form is issued. */
export const FORM_1099_THRESHOLD = 600;

export type TaxReport = {
  year: number;
  handymanName: string;
  jobCount: number;
  grossEarnings: number;
  netEarnings: number;
  platformFees: number;
  /** Net is what the pro was actually paid, so it is what the threshold tests. */
  over1099Threshold: boolean;
  bookings: {
    id: string;
    completedAt: Date | null;
    serviceTitle: string;
    serviceCategory: string;
    customerName: string;
    grossAmount: number;
    platformFee: number;
    netAmount: number;
  }[];
};

export async function buildTaxReport(userId: string, name: string, year: number): Promise<TaxReport> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const bookings = await prisma.booking.findMany({
    where: { handymanId: userId, status: "COMPLETED", completedAt: { gte: start, lt: end } },
    include: {
      service: { select: { title: true, category: true } },
      customer: { select: { name: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  const grossEarnings = bookings.reduce((s, b) => s + b.totalPrice, 0);
  const netEarnings = bookings.reduce((s, b) => s + handymanNet(b.totalPrice), 0);

  return {
    year,
    handymanName: name,
    jobCount: bookings.length,
    grossEarnings,
    netEarnings,
    platformFees: grossEarnings - netEarnings,
    over1099Threshold: netEarnings >= FORM_1099_THRESHOLD,
    bookings: bookings.map((b) => ({
      id: b.id,
      completedAt: b.completedAt,
      serviceTitle: b.service.title,
      serviceCategory: b.service.category,
      customerName: b.customer.name,
      grossAmount: b.totalPrice,
      platformFee: b.totalPrice - handymanNet(b.totalPrice),
      netAmount: handymanNet(b.totalPrice),
    })),
  };
}

/** The same report as a spreadsheet. Quoting is mandatory: service titles and
 *  customer names contain commas, and one unquoted comma shifts every column
 *  after it. */
export function taxReportCsv(report: TaxReport): string {
  const rows: (string | number)[][] = [
    ["Date", "Booking ID", "Service", "Customer", "Gross ($)", "Platform Fee ($)", "Net ($)"],
    ...report.bookings.map((b) => [
      (b.completedAt ?? new Date()).toISOString().split("T")[0],
      b.id.slice(-8).toUpperCase(),
      b.serviceTitle,
      b.customerName,
      b.grossAmount.toFixed(2),
      b.platformFee.toFixed(2),
      b.netAmount.toFixed(2),
    ]),
    [],
    ["", "", "", "TOTAL", report.grossEarnings.toFixed(2), report.platformFees.toFixed(2), report.netEarnings.toFixed(2)],
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
