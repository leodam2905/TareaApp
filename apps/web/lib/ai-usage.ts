// Token accounting for the AI routes.
//
// There was none. Six endpoints called a paid API and nothing recorded what any
// of them consumed, so "what does a booking cost in AI" and "is another
// provider cheaper" were both unanswerable — you cannot compare against a
// number you do not have.
//
// Deliberately logs rather than writes to a table. Cloud Run ships stdout to
// Cloud Logging, which aggregates and queries it for free; a usage table would
// need a migration, a retention policy and a cleanup cron to answer the same
// question worse.
//
// Tokens only, no dollar figure. Prices change and a hardcoded rate card goes
// stale silently — worse than no number, because it looks authoritative.
// Multiply by the current published rate when you need cost:
//
//   gcloud logging read 'jsonPayload.kind="ai_usage"' --format json \
//     | jq -s 'group_by(.jsonPayload.model)[]
//             | {model: .[0].jsonPayload.model,
//                in:  (map(.jsonPayload.inputTokens)  | add),
//                out: (map(.jsonPayload.outputTokens) | add)}'

/** The subset of an Anthropic response this reads. */
type UsageLike = {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null;
  model?: string;
};

/**
 * Records what one model call consumed.
 *
 * Never throws. This is instrumentation on a path that is already returning a
 * useful answer to a customer — a malformed usage object must not turn a good
 * diagnosis into a 500.
 */
export function logAiUsage(route: string, message: UsageLike, extra?: Record<string, unknown>) {
  try {
    const u = message?.usage;
    if (!u) return;
    console.log(
      JSON.stringify({
        kind: "ai_usage",
        route,
        model: message.model ?? "unknown",
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        // Present only when prompt caching is in play; kept so a future caching
        // change shows up as a drop in billable input rather than a mystery.
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        ...extra,
      }),
    );
  } catch {
    /* instrumentation must never break the request */
  }
}
