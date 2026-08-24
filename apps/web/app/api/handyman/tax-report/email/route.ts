import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { buildTaxReport, taxReportCsv, FORM_1099_THRESHOLD } from "@/lib/tax-report";

// Emails the pro their own annual earnings as a CSV attachment.
//
// The app has no share sheet (no share_plus / path_provider), and adding one
// for a screen visited once a year is the wrong trade. Email is also where the
// file usually needs to end up: forwarded to whoever does the pro's taxes.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "No email address on your account." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseInt(String(body?.year ?? ""), 10);
  const thisYear = new Date().getFullYear();
  const year = Number.isFinite(parsed) && parsed >= 2020 && parsed <= thisYear ? parsed : thisYear;

  const report = await buildTaxReport(user.id, user.name, year);
  if (report.jobCount === 0) {
    return NextResponse.json({ error: `No completed jobs in ${year}.` }, { status: 400 });
  }

  // Sent to the account's own address only — never an address from the request
  // body, which would turn this into a way to mail someone else's earnings.
  await sendEmail({
    to: user.email,
    subject: `Your Tarea earnings report — ${year}`,
    attachments: [
      {
        filename: `tarea-earnings-${year}.csv`,
        content: Buffer.from(taxReportCsv(report), "utf8").toString("base64"),
      },
    ],
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#0F172A;margin:0 0 8px">Your ${year} earnings</h2>
      <p style="color:#64748B;margin:0 0 20px">${report.jobCount} completed job${report.jobCount === 1 ? "" : "s"}. The attached CSV lists every one.</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        <tr><td style="padding:8px 0;color:#64748B">Gross</td><td style="text-align:right;color:#0F172A">$${report.grossEarnings.toFixed(2)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B">Tarea fee</td><td style="text-align:right;color:#0F172A">-$${report.platformFees.toFixed(2)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;color:#0F172A;border-top:1px solid #E2E8F0">Net paid to you</td><td style="text-align:right;font-weight:700;color:#0F172A;border-top:1px solid #E2E8F0">$${report.netEarnings.toFixed(2)}</td></tr>
      </table>
      ${report.over1099Threshold
        ? `<p style="background:#FEF3C7;color:#B45309;padding:12px 14px;border-radius:10px;margin:20px 0 0;font-size:14px">You were paid more than $${FORM_1099_THRESHOLD} in ${year}, so Tarea will issue you an IRS Form 1099-NEC. Keep this report for your records.</p>`
        : ""}
      <p style="color:#94A3B8;font-size:13px;margin:20px 0 0">You are an independent contractor and responsible for your own taxes. This report is a record of what Tarea paid you — it is not tax advice.</p>
    </div>`,
  });

  return NextResponse.json({ ok: true, sentTo: user.email, year, jobCount: report.jobCount });
}
