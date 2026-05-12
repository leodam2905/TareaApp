import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Bad request", { status: 400 });
  }

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
