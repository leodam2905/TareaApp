import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/ai-usage";
import type { CredentialKind } from "@/lib/credentials";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Same bound as /api/ai/receipt and /api/ai/diagnose: ~5MB image. */
const MAX_BYTES = 5_000_000;

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

export interface CredentialExtract {
  /** ISO date, or null when the model could not find one. */
  expiresAt: string | null;
  /** Licence number, or insurance policy number. */
  number: string | null;
  /** The name the document is issued to. */
  name: string | null;
  /** 0-100, the model's own confidence that it read the document correctly. */
  confidence: number;
  /** Anything that should stop an admin approving on autopilot. */
  notes: string | null;
  /** When the reading was taken, so a stale proposal is recognisable. */
  readAt: string;
}

const PROMPT: Record<CredentialKind, string> = {
  license:
    "This image is a contractor's trade licence. Read it and report the EXPIRY date, the licence number, and the name the licence is issued to.",
  insurance:
    "This image is a certificate of liability insurance. Read it and report the policy EXPIRY date, the policy number, and the named insured.",
};

/**
 * Read the expiry, number and name off a credential document.
 *
 * EXTRACTION ONLY, and the distinction matters more here than on a receipt.
 * `effectiveStatus` downgrades an approved credential to `expired` from the
 * stored expiry, and credentialBadges gates who may take work at or over the
 * CSLB $1,000 cap. An expiry read a year long keeps a lapsed licence clearing
 * that gate silently, and the pro it wrongly qualifies has no way to notice.
 *
 * So this never writes a credential field. It returns a proposal that an admin
 * confirms while looking at the same document — which they already had to do to
 * approve it. The value it adds is that the admin panel previously had no
 * expiry input at all, so nobody could record one and no credential ever
 * expired.
 *
 * Returns null on any failure. A document that cannot be read is not an error
 * worth failing an upload over — it just means the admin types the date, which
 * is what happened before this existed.
 */
export async function extractCredential(
  kind: CredentialKind,
  docUrl: string,
): Promise<CredentialExtract | null> {
  try {
    const res = await fetch(docUrl);
    if (!res.ok) return null;

    const declared = (res.headers.get("content-type") || "").split(";")[0].trim();
    // PDFs are common for insurance certificates and are NOT images — the
    // vision block would reject them. Skipped rather than mangled.
    if (!MEDIA_TYPES.includes(declared as MediaType)) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;

    // Structured outputs (output_config) would fit here, but the pinned SDK is
    // ^0.39.0 and does not type it. The JSON contract lives in the prompt and
    // is parsed below, the same way /api/ai/receipt and /api/ai/diagnose work.
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: declared as MediaType, data: buf.toString("base64") } },
          {
            type: "text",
            text:
              `${PROMPT[kind]}\n\n` +
              "Report ONLY what is printed on the document. Rules:\n" +
              "- If a field is not visible, or you are unsure you are reading it correctly, return null for it rather than a guess. A null costs an admin ten seconds; a wrong date can keep an expired credential valid.\n" +
              "- Do NOT infer an expiry from an issue date, a print date, or a term length. Return the expiry only if the document states it.\n" +
              "- If the document is not the kind of document described above, set confidence to 0 and say so in notes.\n" +
              "- Note in `notes` anything an approver should check by eye: alterations, a date already in the past, a name that looks like a company rather than a person, or poor legibility.\n\n" +
              'Reply with JSON only, no prose and no code fence: {"expiresAt":"YYYY-MM-DD or null","number":"string or null","name":"string or null","confidence":0-100,"notes":"string or null"}',
          },
        ],
      }],
    });

    logAiUsage("credential-extract", message);

    const text = message.content.find(b => b.type === "text");
    if (!text || text.type !== "text") return null;

    // Tolerate a code fence even though the prompt forbids one — a fence is a
    // formatting slip, not a failed reading, and discarding the whole result
    // over it would send the admin back to typing the date by hand.
    const raw = text.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw) as Omit<CredentialExtract, "readAt">;

    // A date the model invented in the wrong century, or one already past, is
    // worth surfacing rather than storing as a plausible-looking proposal.
    let expiresAt = parsed.expiresAt;
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) expiresAt = null;
    }

    return { ...parsed, expiresAt, readAt: new Date().toISOString() };
  } catch {
    return null;
  }
}
