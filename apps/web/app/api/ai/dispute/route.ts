import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId, customerStatement, handymanStatement } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { title: true } },
      customer: { select: { name: true } },
      handyman: { select: { name: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `You are a neutral dispute resolution assistant for Tarea, a handyman marketplace. Analyze this dispute and provide a structured summary for the admin team.

Booking: "${booking.service.title}"
Customer: ${booking.customer.name}
Handyman: ${booking.handyman.name}
Amount: $${booking.totalPrice}

Customer's statement: "${customerStatement || "No statement provided"}"
Handyman's statement: "${handymanStatement || "No statement provided"}"

Return ONLY a JSON object with:
- "summary": 2–3 sentence neutral summary of the dispute
- "customerClaim": one sentence on what the customer is claiming
- "handymanClaim": one sentence on what the handyman is claiming
- "recommendation": one sentence suggesting a fair resolution path
- "priority": "low" | "medium" | "high" based on the severity

No markdown, just JSON.`,
    }],
  });

  try {
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const analysis = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Save summary to booking notes so admin can see it
    await prisma.booking.update({
      where: { id: bookingId },
      data: { notes: `[AI DISPUTE SUMMARY]\n${JSON.stringify(analysis, null, 2)}\n\n[ORIGINAL NOTES]\n${booking.notes ?? ""}` },
    });

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          title: `Dispute filed — ${booking.service.title}`,
          body: analysis.summary,
          type: "booking_disputed",
          refId: bookingId,
        })),
      });
    }

    return NextResponse.json({ ok: true, analysis });
  } catch {
    return NextResponse.json({ error: "Failed to analyze dispute" }, { status: 500 });
  }
}
