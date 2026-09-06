import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/ai-usage";
import { recordAiTokens } from "@/lib/ai-budget";

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
  const rt = typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined" ? "edge" : "nodejs";
  const errors: string[] = [];
  for (const host of hosts) {
    try {
      const res = await fetch(
        // service-accountS, plural, then `default/token`. Both halves matter and
      // both were wrong here in turn: the singular form and the missing
      // `default` segment each return Go's bare "404 page not found", which
      // reads like DNS or a firewall and is neither.
      `http://${host}/computeMetadata/v1/instance/service-accounts/default/token`,
        { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) {
        // The metadata server explains itself in the body; a bare status has
        // twice sent me after the wrong cause.
        const body = await res.text().catch(() => "");
        errors.push(`${host}: HTTP ${res.status} ${body.slice(0, 90).replace(/\s+/g, " ")}`);
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
  lastTokenError = `[runtime=${rt}] ` + errors.join(" | ").slice(0, 260);
  return null;
}

/** Raw status+body of the last failed Vertex call, for the health endpoint. */
let lastGeminiFailure: string | null = null;
export function lastGeminiError(): string | null {
  return lastGeminiFailure;
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
  if (!res.ok) {
    // Never discard this. The fallback is dormant, so a swallowed Vertex error
    // is only discovered during the outage it exists to survive -- and a guessed
    // cause ("check IAM") sent a whole evening chasing the wrong thing once.
    lastGeminiFailure = `HTTP ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
    return null;
  }
  lastGeminiFailure = null;

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
    // Three attempts, spaced, before declaring the fallback dead.
    // 2026-09-06: a single transient Vertex failure at 08:17 sent an alarming
    // "the AI fallback is not working" email; the path was healthy again minutes
    // later, with nothing changed. A daily check that pages on one failed call is
    // the worst of both -- 24h blind to a real breakage, yet noisy on a blip.
    // A genuine outage survives three tries; a hiccup does not.
    let text: string | null = null;
    let attempts = 0;
    for (let i = 0; i < 3; i++) {
      attempts = i + 1;
      text = await askGemini({
        route: "selftest", model: "", maxTokens: 32,
        text: "Reply with exactly: fallback-ready",
      });
      if (text !== null) break;
      if (i < 2) await new Promise((r) => setTimeout(r, 2_000));
    }
    return text === null
      ? { ok: false, token: true, model: GEMINI_MODEL,
          detail: `Vertex call failed after ${attempts} attempts — ${lastGeminiError() || "no response body captured"}` }
      : { ok: true, token: true, model: GEMINI_MODEL, reply: text.trim().slice(0, 40) };
  } catch (e) {
    return { ok: false, token: true, model: GEMINI_MODEL, detail: String(e).slice(0, 140) };
  }
}


/** One turn of a conversation, in the shape the chat route already uses. */
export interface Turn { role: "user" | "assistant"; content: string }

/**
 * The chat route's shape: multi-turn, a system prompt, and a streamed reply.
 *
 * Returns a ReadableStream of UTF-8 text either way, so the route hands the
 * client the same thing it always did.
 *
 * ONE DELIBERATE ASYMMETRY. Claude streams token by token; the Gemini fallback
 * does not — it answers in full and is emitted as a single chunk. Streaming
 * Vertex means parsing SSE for a path that runs only while Anthropic is down,
 * and a reply that arrives whole a second later is a far smaller degradation
 * than no reply at all. If the fallback ever becomes the common path, this is
 * the first thing to revisit.
 */
export async function streamWithFallback(opts: {
  route: string;
  model: string;
  maxTokens: number;
  system: string;
  messages: Turn[];
}): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  try {
    const stream = anthropic.messages.stream({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    });
    // Await the first event so a 529 surfaces HERE, where it can still be
    // caught, rather than mid-stream once headers are already sent.
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();
    return new ReadableStream({
      async start(controller) {
        const emit = (chunk: { type: string; delta?: { type: string; text?: string } }) => {
          if (chunk?.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text ?? ""));
          }
        };
        try {
          if (!first.done) emit(first.value as never);
          for (let n = await iterator.next(); !n.done; n = await iterator.next()) emit(n.value as never);
        } catch (err) {
          console.error(`[${opts.route}] stream broke mid-flight:`, err);
        } finally {
          controller.close();
        }
      },
    });
  } catch (err) {
    if (!isRetryable(err)) throw err;
    const reason = `${(err as { status?: number })?.status ?? "network"}`;

    // Gemini takes the system prompt as systemInstruction, and calls the
    // assistant role "model".
    const token = await vertexToken();
    if (!token) throw err;
    const url =
      `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}` +
      `/locations/${LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: opts.messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: opts.maxTokens },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw err;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw err;

    console.log(JSON.stringify({ kind: "ai_fallback", route: opts.route, reason, model: GEMINI_MODEL }));
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
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
    // Also into ai_daily_usage, where the cap lives. logAiUsage goes to Cloud
    // Logging, which cannot be read synchronously to weight a budget by cost --
    // per-route REQUEST counts say which route is busy, tokens say which is
    // expensive, and a vision call is worth many text ones. Awaited, not
    // fire-and-forget: a floating promise on Cloud Run can be dropped when the
    // instance is reclaimed, and it never throws, so it cannot break the reply.
    await recordAiTokens(
      ask.route,
      message.usage?.input_tokens ?? 0,
      message.usage?.output_tokens ?? 0,
    );
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
