/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertHashable, canonicalJson, chainHead, hash32Bytes, hashRecord, replayChain, UnhashableValueError, verifyRecord, ZERO_HASH } from "./hashing";
import { buildDecisionBody, GENESIS_SLOT, mandateFingerprint } from "./record";
import { presetMandate } from "./presets";
import type { Hash32 } from "../types/primitives";

const vectors = JSON.parse(readFileSync(new URL("../../../../anchor/tests/vectors/desk/chain-head.json", import.meta.url), "utf8")) as {
  canonical: { body: unknown; json: string; sha256: Hash32 };
  steps: { seq: number; decisionHash: Hash32; prevHead: Hash32; head: Hash32 }[];
};

describe("canonical JSON (RFC 8785 on the restricted domain)", () => {
  it("sorts keys, keeps arrays, escapes like JSON.stringify and turns -0 into 0", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x y"], c: { z: -0, y: 0 } })).toBe('{"a":[true,null,"x y"],"b":1,"c":{"y":0,"z":0}}');
  });

  it("refuses floats, bigints, undefined and class instances, naming the path", () => {
    expect(() => assertHashable({ a: { b: 0.1 } })).toThrow(UnhashableValueError);
    expect(() => assertHashable({ a: { b: 0.1 } })).toThrow("a.b");
    expect(() => assertHashable({ n: 1n })).toThrow("bigint");
    expect(() => assertHashable({ u: undefined })).toThrow("undefined");
    expect(() => assertHashable({ d: new Date(0) })).toThrow("plain object");
    expect(() => assertHashable([1, [2, [3.5]]])).toThrow("[1][1][0]");
  });

  it("matches the shared vector's bytes and sha256", () => {
    expect(canonicalJson(vectors.canonical.body)).toBe(vectors.canonical.json);
    expect(hashRecord(vectors.canonical.body)).toBe(vectors.canonical.sha256);
    expect(verifyRecord(vectors.canonical.body, vectors.canonical.sha256)).toBe(true);
    expect(verifyRecord({ ...(vectors.canonical.body as object), a: 2 }, vectors.canonical.sha256)).toBe(false);
  });
});

describe("the hash chain", () => {
  it("replays the shared vector step by step from the zero genesis", () => {
    let head = ZERO_HASH;
    for (const step of vectors.steps) {
      expect(step.prevHead).toBe(head);
      head = chainHead(head, BigInt(step.seq), step.decisionHash);
      expect(head).toBe(step.head);
    }
    expect(replayChain(ZERO_HASH, 1n, vectors.steps.map((s) => s.decisionHash))).toBe(head);
  });

  it("binds the sequence number: the same hash at another seq gives another head", () => {
    const [first] = vectors.steps;
    expect(chainHead(ZERO_HASH, 2n, (first as { decisionHash: Hash32 }).decisionHash)).not.toBe((first as { head: Hash32 }).head);
    expect(hash32Bytes(ZERO_HASH)).toHaveLength(32);
    expect(() => hash32Bytes("0x00" as Hash32)).toThrow("32-byte");
  });
});

describe("a record body hashes the same every time", () => {
  it("builds a quiet check, validates it strictly and fingerprints the mandate", () => {
    const mandate = presetMandate("ailabs");
    expect(mandate).not.toBeNull();
    const fingerprint = mandateFingerprint(mandate!);
    expect(fingerprint).toMatch(/^0x[0-9a-f]{64}$/);
    const body = buildDecisionBody({
      chainId: 101,
      owner: "3Xk9zvS1gA1T4S1L1u4bR5e9zFq1XW3hqf7dcs8pXjqQ",
      slot: GENESIS_SLOT,
      chain: { seqBefore: 0, headBefore: ZERO_HASH },
      decidedAtIso: "2026-09-22T14:00:00.000Z",
      wake: { scheduledForIso: "2026-09-22T14:00:00.000Z", trigger: "hourly" },
      mode: "practice",
      mandate: { version: 1, fingerprint },
      valuation: null,
      need: null,
      deferral: null,
      blockers: [],
      evidence: [],
      answer: null,
      gate: null,
      override: null,
      outcome: "NOTHING_TO_DO",
      ask: null,
      approvalOf: null,
      preview: null,
      paper: { cashE6: 1_000_000_000n, positions: {} },
    });
    expect(body.kind).toBe("decision");
    expect(body.paper).toEqual({ cash: "1000", positions: {} });
    const once = hashRecord(body);
    expect(hashRecord(JSON.parse(JSON.stringify(body)))).toBe(once);
    // A changed byte is a different fingerprint: what "Check it" relies on.
    expect(hashRecord({ ...body, outcome: "WAITED" })).not.toBe(once);
  });
});
