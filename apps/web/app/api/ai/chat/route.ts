import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { streamWithFallback } from "@/lib/ai-fallback";
import { clientIp } from "@/lib/client-ip";


const SYSTEM = `You are Tarea's friendly AI assistant. Tarea is a US-based handyman marketplace connecting customers with vetted, background-checked independent service providers for home services.

Key facts:
- Services: plumbing, electrical, carpentry, painting, cleaning, HVAC, roofing, landscaping, moving, appliance repair, general handyman
- Platform fee: 10% added to the service price at checkout
- All handymen must pass a background check and have a profile photo before appearing in search
- Payments are processed securely via Stripe
- Customers can post job requests and receive bids, or browse and book handymen directly
- After a job is completed, customers can leave a star rating and review
- Disputes can be filed from the booking detail page
- Handymen are independent contractors, not Tarea employees
- Support email: support@taptarea.com
- Website: taptarea.com

Be helpful, warm, and concise. Answer in 1–3 sentences when possible. If you don't know something specific, direct them to support@taptarea.com.`;

export async function POST(req: NextRequest) {
  // Public endpoint — rate limit per IP to prevent API-key cost abuse.
  const ip = clientIp(req);
  if (!rateLimit(`ai:${ip}`, 20, 60_000).ok) {
    return new Response("Too many requests", { status: 429 });
  }

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Bad request", { status: 400 });
  }
  // Cap conversation length to bound input tokens.
  if (messages.length > 30) {
    return new Response("Conversation too long", { status: 400 });
  }

  // Claude first, Gemini if Claude cannot answer.
  //
  // The helper owns the streaming so the fallback can be reached before any
  // byte is sent: it awaits the first event, so a 529 surfaces while it can
  // still be caught rather than mid-stream with headers already on the wire.
  //
  // The fallback does not stream — it answers in full and arrives as one
  // chunk. Parsing Vertex SSE for a path that only runs while Anthropic is
  // down is not worth it, and a whole reply a second later beats no reply.
  const readable = await streamWithFallback({
    route: "chat",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 512,
    system: SYSTEM,
    messages,
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
