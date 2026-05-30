import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = [
  "PLUMBING", "ELECTRICAL", "CARPENTRY", "PAINTING", "CLEANING",
  "HVAC", "ROOFING", "LANDSCAPING", "MOVING", "APPLIANCE_REPAIR", "GENERAL",
];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { imageBase64, mediaType, description } = await req.json();

  if (!imageBase64 && !description?.trim()) {
    return NextResponse.json({ error: "Image or description required" }, { status: 400 });
  }

  const content: Anthropic.MessageParam["content"] = [];

  if (imageBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: (mediaType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: imageBase64,
      },
    });
  }

  content.push({
    type: "text",
    text: `You are a home maintenance expert helping a homeowner identify what type of service professional they need.

${description?.trim() ? `Customer's description: "${description}"` : ""}
${imageBase64 ? "Analyze the image above showing the home issue." : ""}

Diagnose the home issue and return ONLY a valid JSON object:
- "category": one of: ${CATEGORIES.join(", ")}
- "confidence": "high", "medium", or "low"
- "explanation": 2-3 sentences describing what the issue likely is and why this service category is the right fit
- "urgency": "urgent" (safety risk — fix today), "soon" (fix within a week), or "routine" (can be scheduled)
- "tips": array of exactly 2 short, practical tips the homeowner can do right now while waiting for the pro

Return nothing but the JSON. No markdown fences, no explanation.`,
  });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: "Could not analyze the issue. Please try again." }, { status: 500 });
  }
}
