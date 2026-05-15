import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name:    z.string().min(2).max(100),
  email:   z.string().email().max(200),
  role:    z.string().max(50).optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
});

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rl = rateLimit(`contact:${ip}`, 5, 3_600_000); // 5 per hour
  if (!rl.ok) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  try {
    const body = schema.parse(await req.json());
    const { name, email, role, subject, message } = body;
    const supportEmail = "support@taptarea.com";

    await sendEmail({
      to: supportEmail,
      subject: `[Support] ${esc(subject)}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
          <h2 style="color:#0F172A;margin:0 0 16px">New Support Request</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748B;width:100px">From</td><td style="padding:8px 0;color:#0F172A;font-weight:600">${esc(name)} &lt;${esc(email)}&gt;</td></tr>
            <tr><td style="padding:8px 0;color:#64748B">Role</td><td style="padding:8px 0;color:#0F172A">${esc(role || "Not specified")}</td></tr>
            <tr><td style="padding:8px 0;color:#64748B">Subject</td><td style="padding:8px 0;color:#0F172A">${esc(subject)}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#F8FAFC;border-radius:8px;color:#334155;white-space:pre-wrap">${esc(message)}</div>
          <p style="color:#94A3B8;font-size:12px;margin-top:24px">Reply directly to this email to respond to ${esc(name)}.</p>
        </div>
      `,
    });

    await sendEmail({
      to: email,
      subject: "We received your message — Tarea Support",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#1E3A8A,#38BDF8);border-radius:10px;display:flex;align-items:center;justify-content:center">
              <span style="color:white;font-size:18px">🔧</span>
            </div>
            <span style="font-size:20px;font-weight:800;color:#0F172A">Tarea</span>
          </div>
          <h1 style="font-size:22px;font-weight:700;color:#0F172A;margin:0 0 8px">We got your message, ${esc(name.split(" ")[0])}!</h1>
          <p style="color:#64748B;margin:0 0 16px">Our support team will get back to you within <strong>1 business day</strong>. Here's what you sent us:</p>
          <div style="padding:16px;background:#F8FAFC;border-radius:8px;color:#334155;border-left:4px solid #38BDF8;margin-bottom:24px">
            <p style="margin:0 0 4px;font-weight:600;color:#0F172A">${esc(subject)}</p>
            <p style="margin:0;white-space:pre-wrap;font-size:14px">${esc(message)}</p>
          </div>
          <p style="color:#94A3B8;font-size:13px">Need urgent help? Reply directly to this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
