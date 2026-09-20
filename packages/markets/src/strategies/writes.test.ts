import { encodeStrategyMetadata, type StrategyMetadata, type StrategySpec } from "@agari/core/strategies";
import { describe, expect, it } from "vitest";
import { planRevision, STRATEGY_METADATA_MAX_BYTES } from "./writes";

const spec: StrategySpec = { preset: "momentum", lookback: 5, thresholdBps: 20 } as StrategySpec;
const meta = (description: string): StrategyMetadata => ({ name: "Quiet open", description, spec });

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
}

/** What the program ends up holding: `metadata_len` zero bytes with each piece written at its offset. */
function assemble(plan: Awaited<ReturnType<typeof planRevision>>): Uint8Array {
  const out = new Uint8Array(plan.revision.metadataLen);
  out.set(plan.revision.firstChunk, 0);
  for (const { offset, chunk } of plan.rest) out.set(chunk, offset);
  return out;
}

describe("planRevision", () => {
  it("sends short words in one piece", async () => {
    const plan = await planRevision(spec, meta("Follows the first move of the session."), 0n);
    expect(plan.rest).toEqual([]);
    expect(plan.revision.firstChunk.length).toBe(plan.revision.metadataLen);
  });

  it("cuts long words into pieces that reassemble to exactly what was hashed", async () => {
    // Multi-byte characters on purpose: the cut is in bytes, and a piece may end inside one.
    const plan = await planRevision(spec, meta("上がり — ".repeat(120)), 2_500_000n);
    expect(plan.rest.map((piece) => piece.offset)).toEqual([700, 1_600]);
    expect(plan.revision.firstChunk.length).toBe(700);
    for (const { chunk } of plan.rest) expect(chunk.length).toBeLessThanOrEqual(900);

    const whole = assemble(plan);
    expect(new TextDecoder().decode(whole)).toBe(encodeStrategyMetadata(meta("上がり — ".repeat(120))));
    expect(plan.revision.metadataHash).toEqual(await sha256(whole));
    expect(plan.revision.subscriptionFeeBase).toBe(2_500_000n);
    // The pieces tile the text with no gap and no overlap.
    const covered = plan.rest.reduce((sum, piece) => sum + piece.chunk.length, plan.revision.firstChunk.length);
    expect(covered).toBe(plan.revision.metadataLen);
  });

  it("refuses words longer than a strategy holds, before anything is sent", async () => {
    await expect(planRevision(spec, meta("x".repeat(STRATEGY_METADATA_MAX_BYTES)), 0n)).rejects.toThrow(/a strategy holds 2048/);
  });

  it("hashes the spec separately, so the same spec under new words keeps its hash", async () => {
    const a = await planRevision(spec, meta("one"), 0n);
    const b = await planRevision(spec, meta("two"), 0n);
    expect(a.revision.specHash).toEqual(b.revision.specHash);
    expect(a.revision.metadataHash).not.toEqual(b.revision.metadataHash);
  });
});
