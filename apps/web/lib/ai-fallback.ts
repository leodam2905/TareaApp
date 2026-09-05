import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/ai-usage";

/**
 * Run a prompt on Claude, and on Gemini when Claude cannot answer.
 *
 * WHY THIS EXISTS. On 2026-09-03 the Anthropic API returned 529 `overloaded`
 * for about ten minutes. Every AI route here depends on a single call with no
 * alternative, so /ai/price-estimate and /ai/instant-quote both 500'd with an
 * empty body and NOBODY COULD POST A JOB. The SDK already retries twice; a
 * sustained capacity problem outlasts that, which is the point — a second model
 * from the same provider shares the same saturation. A second PROVIDER does not.
 *
 * Gemini reaches us through Vertex in the project this app already runs in, so
 * there is no API key: the Cloud Run service account mints a token from the
 * metadata server. That matters beyond convenience — an API key is a long-lived
 * secret to store, rotate and eventually leak, and this codebase spent a week in
 * August doing exactly that after one ended up in .env.
 *
 * WHAT IT DOES NOT DO. It does not silently change which model answers. Claude
 * is tried first every time and the fallback fires only on the failures that
 * mean "try again elsewhere" — 429, 5xx and 529. A 400 is our bug and is
 * re-thrown unchanged, because retrying a malformed request on a second
 * provider just produces a second, more confusing error.
 *
 * The caller gets back which provider answered, so a route can label a
 * degraded answer if it wants to.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "splendid-drake-497611-h6";
const LOCATION = "us-central1";
/** Flash, not Pro. This is the degraded path: answering at all beats answering
 *  perfectly, and a fallback that is expensive is one nobody enables. */
const GEMINI_MODEL = "gemini-2.5-flash";

export type Provider = "anthropic" | "gemini";

export interface FallbackResult {
  text: string;
  provider: Provider;
  /** Set when Claude failed, so callers and logs can see why we fell back. */
  fallbackReason?: string;
}

/** Text, or text plus one image — the shape every route here uses. */
export interface Ask {
  route: string;
  model: string;
  maxTokens: number;
  text: string;
  image?: { base64: string; mediaType: string };
}

/**
 * Retryable means "the provider could not serve this right now".
 *
 * 429 rate limit, 5xx, and 529 overloaded — the last is the one that actually
 * happened. A 400/401/403 is ours to fix and must not be masked by a fallback.
 */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") return status === 429 || status >= 500;
  // Network-level failures (DNS, reset, timeout) carry no status but are
  // exactly the case a second provider exists for.
  const name = (err as { name?: string })?.name ?? "";
  return name === "APIConnectionError" || name === "APIConnectionTimeoutError";
}

/**
 * A token for Vertex, from the metadata server.
 *
 * No key, no secret, no rotation: the Cloud Run runtime service account
 * (277743379820-compute@) holds roles/aiplatform.user and the platform mints
 * short-lived tokens on request. Off Cloud Run there is no metadata server, so
 * this returns null and the fallback is simply unavailable in local dev —
 * which is correct, rather than reaching for a key to paper over it.
 */
let lastTokenError = "";

/** The last reason a token could not be obtained — surfaced by the self test,
 *  because "no token" alone is not enough to fix anything. */
export function lastVertexTokenError(): string {
  return lastTokenError;
}

async function vertexToken(): Promise<string | null> {
  // Two addresses, because DNS for metadata.google.internal is the part that
  // most often is not there; 169.254.169.254 is the same server by IP and
  // needs no resolver. Ten seconds, not two: the first call on a cold instance
  // was being cut off before it answered.
  const hosts = ["metadata.google.internal", "169.254.169.254"];
  const errors: string[] = [];
  for (const host of hosts) {
    try {
      const res = await fetch(
        `http://${host}/computeMetadata/v1/instance/service-account/token`,
        { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) {
        errors.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { access_token?: string };
      if (data.access_token) {
        lastTokenError = "";
        return data.access_token;
      }
      errors.push(`${host}: no access_token in body`);
    } catch (e) {
      errors.push(`${host}: ${(e as Error)?.name ?? "error"} ${(e as Error)?.message ?? ""}`.trim());
    }
  }
  lastTokenError = errors.join(" | ").slice(0, 300);
  return null;
}

async function askGemini(ask: Ask): Promise<string | null> {
  const token = await vertexToken();
  if (!token) return null;

  const parts: unknown[] = [];
  if (ask.image) {
    parts.push({ inlineData: { mimeType: ask.image.mediaType, data: ask.image.base64 } });
  }
  parts.push({ text: ask.text });

  const url =
    `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}` +
    `/locations/${LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: ask.maxTokens },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/**
 * Prove the fallback path works, from inside the container, on demand.
 *
 * The fallback is dormant by design — it only runs when Anthropic is failing,
 * which is the worst moment to discover that the Vertex half was never
 * reachable. IAM, API enablement and the metadata server are all things that
 * can be silently wrong for weeks. This exercises exactly the code the fallback
 * uses, so a green result means the real path works, not an approximation.
 */
export async function geminiSelfTest(): Promise<{
  ok: boolean;
  token: boolean;
  model: string;
  reply?: string;
  detail?: string;
}> {
  const token = await vertexToken();
  if (!token) {
    return { ok: false, token: false, model: GEMINI_MODEL,
      detail: `no metadata-server token — ${lastVertexTokenError() || "expected off Cloud Run, a problem on it"}` };
  }
  try {
    const text = await askGemini({
      route: "selftest", model: "", maxTokens: 32,
      text: "Reply with exactly: fallback-ready",
    });
    return text === null
      ? { ok: false, token: true, model: GEMINI_MODEL, detail: "Vertex call failed — check roles/aiplatform.user on the runtime service account" }
      : { ok: true, token: true, model: GEMINI_MODEL, reply: text.trim().slice(0, 40) };
  } catch (e) {
    return { ok: false, token: true, model: GEMINI_MODEL, detail: String(e).slice(0, 140) };
  }
}

export async function askWithFallback(ask: Ask): Promise<FallbackResult> {
  const content: Anthropic.MessageParam["content"] = [];
  if (ask.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: ask.image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: ask.image.base64,
      },
    });
  }
  content.push({ type: "text", text: ask.text });

  try {
    const message = await anthropic.messages.create({
      model: ask.model,
      max_tokens: ask.maxTokens,
      messages: [{ role: "user", content }],
    });
    logAiUsage(ask.route, message);
    const block = message.content.find(b => b.type === "text");
    return { text: block && block.type === "text" ? block.text : "", provider: "anthropic" };
  } catch (err) {
    if (!isRetryable(err)) throw err;

    const reason = `${(err as { status?: number })?.status ?? "network"}`;
    const text = await askGemini(ask);
    if (text === null) throw err; // fallback unavailable — surface the real error

    // Logged under a distinct route name so a spike in fallback traffic is
    // visible rather than hiding inside the normal usage line.
    console.log(JSON.stringify({ kind: "ai_fallback", route: ask.route, reason, model: GEMINI_MODEL }));
    return { text, provider: "gemini", fallbackReason: reason };
  }
}
