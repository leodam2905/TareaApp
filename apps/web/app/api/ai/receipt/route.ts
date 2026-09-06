import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { askWithFallback } from "@/lib/ai-fallback";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ~5MB image -> ~6.8MB base64, same bound as /api/ai/diagnose.
const MAX_IMAGE_BASE64_LEN = 7_000_000;

/**
 * Read the total off a materials receipt.
 *
 * EXTRACTION ONLY. This endpoint reports what it can see and how sure it is; it
 * never decides what to charge or refund. The comparison against what the pro
 * typed happens in the booking route, and a disagreement routes to a human.
 *
 * That split matters because the money moves toward the customer. An OCR misread
 * that comes in low would refund a customer for materials the pro genuinely
 * bought, out of the pro's own pocket, with no way for them to notice. A model
 * is good enough to catch a discrepancy and not good enough to settle one.
 *
 * Authenticated and pro-only: unlike /diagnose this is not a public marketing
 * surface, and vision calls cost real money per request.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`ai-receipt:${user.id}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64) {
    return NextResponse.json({ error: "A photo of the receipt is required." }, { status: 400 });
  }
  if (typeof imageBase64 === "string" && imageBase64.length > MAX_IMAGE_BASE64_LEN) {
    return NextResponse.json({ error: "Image too large (max ~5MB)." }, { status: 413 });
  }

  try {
    // Claude first, Gemini if Claude cannot answer. A pro cannot finish a job
    // while this is down -- completion asks for the receipt -- so an outage
    // here blocks work rather than degrading a nicety.
    //
    // Sonnet 5 is newer and cheaper than the 4.6 this used to run.
    const answer = await askWithFallback({
      route: "receipt",
      model: "claude-sonnet-5",
      maxTokens: 300,
      text: `This is a photo of a purchase receipt for materials bought for a home repair job.

Return ONLY a valid JSON object:
- "total": the GRAND TOTAL actually paid, as a number, including tax. Null if you cannot read it.
- "currency": the currency code if visible, else "USD".
- "merchant": the store name if visible, else null.
- "confidence": "high" if the total is printed clearly and unambiguously, "medium" if legible but partly obscured or ambiguous, "low" if you are guessing.
- "readable": false if this is not a receipt at all, or is too blurred, cropped or dark to read.
- "note": one short sentence, ONLY if something would mislead a reader — more than one receipt in frame, a total that is a subtotal, a refund or return, a handwritten amount. Otherwise null.

Read the printed total. Do not add up line items yourself, and do not infer a total that is not shown — return null instead. If several totals appear, take the final amount paid.

Return nothing but the JSON. No markdown fences, no explanation.`,
      image: { base64: String(imageBase64), mediaType: String(mediaType || "image/jpeg") },
    });

    const text = answer.text;
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Never let a model hand back something unusable as a number.
    const total =
      typeof json.total === "number" && Number.isFinite(json.total) && json.total >= 0
        ? Math.round(json.total * 100) / 100
        : null;
    const confidence = ["high", "medium", "low"].includes(json.confidence) ? json.confidence : "low";

    return NextResponse.json({
      total,
      currency: typeof json.currency === "string" ? json.currency.slice(0, 8) : "USD",
      merchant: typeof json.merchant === "string" ? json.merchant.slice(0, 80) : null,
      confidence,
      readable: json.readable !== false && total !== null,
      note: typeof json.note === "string" ? json.note.slice(0, 200) : null,
    });
  } catch {
    // A failed read must never block a pro from finishing their job. The booking
    // route treats an absent reading as "unverified" and routes it to review.
    return NextResponse.json(
      { total: null, readable: false, confidence: "low", note: "Could not read the receipt." },
      { status: 200 },
    );
  }
}
