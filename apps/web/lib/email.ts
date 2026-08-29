import { Resend } from "resend";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { invoiceToken } from "@/lib/invoice-link";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "Tarea <noreply@taptarea.com>";

function baseTemplate(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Inter,sans-serif;background:#f1f5f9;margin:0;padding:32px 0}
    .card{background:#fff;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#1E3A8A,#0F2560);padding:32px;text-align:center}
    .logo{font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px}
    .badge{display:inline-block;background:rgba(56,189,248,.2);color:#38BDF8;font-size:11px;font-weight:700;padding:4px 12px;border-radius:99px;margin-top:8px;text-transform:uppercase;letter-spacing:.5px}
    .body{padding:32px}
    h2{color:#0F172A;font-size:20px;font-weight:700;margin:0 0 12px}
    p{color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px}
    .btn{display:inline-block;background:#38BDF8;color:#0F172A;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;margin-top:8px}
    .footer{padding:20px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8}
  </style></head><body>
    <div class="card">
      <div class="header">
        <div class="logo">Tarea</div>
        <div class="badge">Handyman Platform</div>
      </div>
      <div class="body">
        <h2>${title}</h2>
        <p>${body}</p>
        ${cta ? `<a href="${cta.url}" class="btn">${cta.label}</a>` : ""}
      </div>
      <div class="footer">© 2026 Tarea. You received this because you have an account on Tarea.</div>
    </div>
  </body></html>`;
}

export async function sendEmail(
  toOrParams:
    | string
    | {
        to: string;
        subject: string;
        html: string;
        // Resend takes attachments as base64 content plus a filename. Exposed
        // here so a report can be delivered as a real file rather than pasted
        // into the body, which is unusable to an accountant.
        attachments?: { filename: string; content: string }[];
      },
  subject?: string,
  title?: string,
  body?: string,
  cta?: { label: string; url: string }
) {
  let to: string, subj: string, html: string;
  let attachments: { filename: string; content: string }[] | undefined;
  if (typeof toOrParams === "object") {
    ({ to, subject: subj, html } = toOrParams);
    attachments = toOrParams.attachments;
  } else {
    to = toOrParams;
    subj = subject!;
    html = baseTemplate(title!, body!, cta);
  }
  if (!resend) {
    // Do NOT log the subject — OTP emails embed the code in the subject line.
    console.log(`[EMAIL → ${to}] (Resend not configured; email not sent)`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject: subj, html, ...(attachments ? { attachments } : {}) });
}

export async function sendInvoiceEmail(params: {
  to: string;
  bookingId: string;
  serviceTitle: string;
  serviceCategory: string;
  handymanName: string;
  scheduledAt: Date;
  address: string;
  city: string;
  totalPrice: number;
  materials?: number;
  /** Materials quoted but not spent, already returned to the card. */
  materialsRefunded?: number;
}) {
  const { to, bookingId, serviceTitle, serviceCategory, handymanName, scheduledAt, address, city, totalPrice, materials = 0, materialsRefunded = 0 } = params;
  const shortId = bookingId.slice(-8).toUpperCase();
  const treaFee = totalPrice * CUSTOMER_FEE_RATE;
  const total = totalPrice + treaFee + materials;
  const dateStr = scheduledAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const category = serviceCategory.replace(/_/g, " ");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Inter,sans-serif;background:#f1f5f9;margin:0;padding:32px 0}
    .card{background:#fff;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#1E3A8A,#0F2560);padding:32px;text-align:center}
    .logo{font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px}
    .badge{display:inline-block;background:rgba(56,189,248,.2);color:#38BDF8;font-size:11px;font-weight:700;padding:4px 12px;border-radius:99px;margin-top:8px;text-transform:uppercase;letter-spacing:.5px}
    .body{padding:32px}
    h2{color:#0F172A;font-size:20px;font-weight:700;margin:0 0 4px}
    .booking-id{color:#94a3b8;font-size:13px;margin:0 0 24px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    td{padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569}
    td:first-child{font-weight:600;color:#0F172A;width:40%}
    .totals{background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px}
    .totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#475569}
    .totals-row.total{font-size:16px;font-weight:700;color:#0F172A;border-top:2px solid #e2e8f0;margin-top:8px;padding-top:12px}
    .footer{padding:20px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8}
    .thank-you{text-align:center;color:#0F172A;font-weight:700;font-size:18px;margin:0 0 8px}
    .thank-sub{text-align:center;color:#64748b;font-size:14px;margin:0 0 24px}
  </style></head><body>
    <div class="card">
      <div class="header">
        <div class="logo">Tarea</div>
        <div class="badge">Invoice</div>
      </div>
      <div class="body">
        <h2>Invoice #${shortId}</h2>
        <p class="booking-id">Booking completed — here is your receipt</p>
        <table>
          <tr><td>Service</td><td>${serviceTitle}</td></tr>
          <tr><td>Category</td><td>${category}</td></tr>
          <tr><td>Handyman</td><td>${handymanName}</td></tr>
          <tr><td>Date</td><td>${dateStr}</td></tr>
          <tr><td>Location</td><td>${address}, ${city}</td></tr>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Service price</span><span>$${totalPrice.toFixed(2)}</span></div>
          <div class="totals-row"><span>Tarea fee (${Math.round(CUSTOMER_FEE_RATE * 100)}%)</span><span>$${treaFee.toFixed(2)}</span></div>
          ${materials > 0 ? `<div class="totals-row"><span>Materials (at cost)</span><span>$${materials.toFixed(2)}</span></div>` : ""}
          ${materialsRefunded > 0 ? `<div class="totals-row" style="color:#047857"><span>Materials refunded</span><span>−$${materialsRefunded.toFixed(2)}</span></div>` : ""}
          <div class="totals-row total"><span>${materialsRefunded > 0 ? "Total paid" : "Total charged"}</span><span>$${(total - materialsRefunded).toFixed(2)}</span></div>
          ${materialsRefunded > 0 ? `<div style="font-size:12px;color:#64748b;padding-top:8px">Your pro spent less on materials than quoted. $${materialsRefunded.toFixed(2)} is on its way back to your card, usually within 5–10 days.</div>` : ""}
        </div>
        <p class="thank-you">Thank you for using Tarea!</p>
        <p class="thank-sub">We hope you're satisfied with the service. Book again anytime.</p>
        <div style="text-align:center;margin:16px 0">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com"}/customer/bookings/${bookingId}/invoice?t=${invoiceToken(bookingId)}"
            style="background:#38BDF8;color:#0F172A;font-weight:700;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;display:inline-block">
            View Full Invoice →
          </a>
        </div>
      </div>
      <div class="footer">© 2026 Tarea US LLC · You received this because you completed a booking on Tarea.</div>
    </div>
  </body></html>`;

  if (!resend) {
    console.log(`[INVOICE EMAIL → ${to}] Booking #${shortId} — $${total.toFixed(2)}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject: `Your Tarea Invoice #${shortId}`, html });
}
