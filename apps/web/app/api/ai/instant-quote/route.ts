import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { category, task, details } = await req.json();

  if (!category || !task) {
    return NextResponse.json({ error: "Category and task required" }, { status: 400 });
  }

  const detailsText = details && Object.keys(details).length
    ? Object.entries(details).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "No additional details provided";

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are a home services pricing expert in the US with 15 years of experience.

Task requested: "${task}" (category: ${category})
Customer details:
${detailsText}

Based on current US market rates for independent handymen, provide an instant quote.

Return ONLY a JSON object with:
- "minPrice": integer, low end of the price range in USD (labor only unless stated)
- "maxPrice": integer, high end of the price range in USD
- "duration": string, estimated time to complete (e.g. "1–2 hours", "half day")
- "includes": array of 3 short strings describing what is included in the price
- "note": one sentence about the biggest variable that could change the price (if any)
- "confidence": "guaranteed" if range is tight (< 30% spread), otherwise "estimate"

No markdown, no extra text — just valid JSON.`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: "Could not generate quote. Try again." }, { status: 500 });
  }
}
