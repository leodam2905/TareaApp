import { describe, it, expect, vi, afterEach } from "vitest";
import { logAiUsage } from "./ai-usage";

const captureOne = (fn: () => void) => {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  fn();
  const calls = spy.mock.calls;
  spy.mockRestore();
  return calls.length ? JSON.parse(calls[0][0] as string) : null;
};

afterEach(() => vi.restoreAllMocks());

describe("logAiUsage", () => {
  it("records what a call consumed, tagged by route and model", () => {
    const line = captureOne(() =>
      logAiUsage("diagnose", {
        model: "claude-sonnet-5",
        usage: { input_tokens: 1500, output_tokens: 320 },
      }),
    );
    expect(line).toMatchObject({
      kind: "ai_usage", route: "diagnose", model: "claude-sonnet-5",
      inputTokens: 1500, outputTokens: 320,
    });
  });

  it("defaults cache counters to zero rather than omitting them", () => {
    // A missing field and a zero read differently when aggregating in jq.
    const line = captureOne(() =>
      logAiUsage("chat", { model: "m", usage: { input_tokens: 10, output_tokens: 5 } }),
    );
    expect(line.cacheWriteTokens).toBe(0);
    expect(line.cacheReadTokens).toBe(0);
  });

  it("stays silent when there is no usage to report", () => {
    expect(captureOne(() => logAiUsage("x", {}))).toBeNull();
    expect(captureOne(() => logAiUsage("x", { usage: null }))).toBeNull();
  });

  it("never throws — a customer's answer must not fail on accounting", () => {
    // The whole point: this runs on a path that has already produced something
    // useful. A malformed usage object must not turn that into a 500.
    const hostile = { get usage(): never { throw new Error("boom"); } } as never;
    expect(() => logAiUsage("diagnose", hostile)).not.toThrow();
  });
});
