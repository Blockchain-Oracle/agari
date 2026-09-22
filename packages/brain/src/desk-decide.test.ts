import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { decideDeskTiming, readDeskTiming, resolveDeskModel } from "./desk-decide";

/** A model that answers with exactly this text, in the V3 shape `ai/test` mocks. */
function answering(text: string, finish: "stop" | "content-filter" = "stop"): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    modelId: "mock-judge",
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: finish, raw: undefined },
      usage: { inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 40, text: 40, reasoning: undefined } },
      warnings: [],
    }),
  });
}

const good = {
  option: "WAIT",
  partPercent: null,
  headline: "Wait because OpenAI trades 15% above its mark, close to your ceiling.",
  confidencePercent: 72,
  reasons: [{ text: "The premium is rich and nothing forces the buy.", evidenceIds: ["e2"] }],
  rejected: [{ option: "ACT_NOW", reason: "The price is near the ceiling." }],
  premiumRead: "rich",
  waitFor: "the premium to narrow",
  warnings: [],
  ruleIds: [],
};
const ids = { evidenceIds: ["e1", "e2", "e3"], ruleIds: ["r1"], privateTexts: ["Never buy on a Sunday, whatever the price does."] };

describe("readDeskTiming", () => {
  it("returns the decision with the model that answered and the call's meta", async () => {
    const read = await readDeskTiming({ system: "s", user: "u", model: answering(JSON.stringify(good)) });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.decision.option).toBe("WAIT");
      expect(read.meta).toMatchObject({ modelId: "mock-provider/mock-judge", totalTokens: 160, finishReason: "stop" });
    }
  });
  it("fails closed on prose, an off-schema shape, a refusal and a timeout", async () => {
    const prose = await readDeskTiming({ system: "s", user: "u", model: answering("Probably wait.") });
    expect(prose).toMatchObject({ ok: false, failure: "parse" });
    const offSchema = await readDeskTiming({ system: "s", user: "u", model: answering(JSON.stringify({ ...good, option: "HOLD" })) });
    expect(offSchema).toMatchObject({ ok: false, failure: "parse" });
    const refused = await readDeskTiming({ system: "s", user: "u", model: answering("", "content-filter") });
    expect(refused.ok).toBe(false);
    const slow = new MockLanguageModelV3({ doGenerate: () => new Promise(() => undefined) });
    const late = await readDeskTiming({ system: "s", user: "u", model: slow, timeoutMs: 20 });
    expect(late).toMatchObject({ ok: false, failure: "timeout", detail: "no answer within 20 ms" });
  });
});

describe("decideDeskTiming", () => {
  it("keeps a good answer as the decision and names the prompt version", async () => {
    const answer = await decideDeskTiming({ model: answering(JSON.stringify(good)), user: "u", ...ids });
    expect(answer.decision?.option).toBe("WAIT");
    expect(answer).toMatchObject({ promptVersion: "desk-timing.v1", error: null, problems: [], styleWords: [] });
  });
  it("refuses an answer that cites an unknown id, promises gain, or quotes the owner's notes — the raw answer stays in the record", async () => {
    const unknownId = await decideDeskTiming({ model: answering(JSON.stringify({ ...good, reasons: [{ text: "x", evidenceIds: ["e9"] }] })), user: "u", ...ids });
    expect(unknownId.decision).toBeUndefined();
    expect(unknownId.problems).toEqual(['cites unknown evidence id "e9"']);
    expect(unknownId.raw?.option).toBe("WAIT");
    const promise = await decideDeskTiming({ model: answering(JSON.stringify({ ...good, headline: "Wait because a profit is likely later." })), user: "u", ...ids });
    expect(promise.decision).toBeUndefined();
    expect(promise.problems[0]).toMatch(/words we never use: profit/);
    const quoting = await decideDeskTiming({ model: answering(JSON.stringify({ ...good, warnings: ["Your rule says never buy on a Sunday, whatever the price does."] })), user: "u", ...ids });
    expect(quoting.problems).toContain("quotes the owner's private notes");
  });
  it("turns a failed read into an answer with the error named and no decision", async () => {
    const answer = await decideDeskTiming({ model: answering("nope"), user: "u", ...ids });
    expect(answer.decision).toBeUndefined();
    expect(answer.error).toMatch(/^parse: the answer was not a timing decision/);
    expect(answer.raw).toBeNull();
  });
  it("resolves the desk's own model ahead of AI_MODEL, and answers null with no credential", () => {
    expect(resolveDeskModel({})).toBeNull();
    const resolved = resolveDeskModel({ DESK_AI_MODEL: "anthropic/claude-opus-5", AI_MODEL: "openai/gpt-5.4", AI_GATEWAY_API_KEY: "x".repeat(16) });
    expect(resolved).toMatchObject({ via: "gateway", providerName: "anthropic", modelId: "claude-opus-5" });
  });
});
