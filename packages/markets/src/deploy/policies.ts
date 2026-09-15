/**
 * `services/ops/config/price-sources.json` (D-003) → `admin_add_policy_version` arguments (prints.md §2.1).
 * Pure: the script reads the file, this maps it, and `versionDiff` compares against a Series read back from chain.
 */
import type { PolicyVersion, PrintPolicy, PrintPolicyInput } from "@agari/clients/agari-events";
import type { LaneBasis } from "@agari/core/types";
import { tokenPolicyFor, tokenPolicyVersions } from "./policies-token";

/** The subset of price-sources.json the engine reads. */
export type PriceSources = {
  defaults: {
    pyth: { graceSec: number; maxConfBps: number; admissionSec: number };
    redstone: { strictSec: number; admissionSec: number; threshold: number };
    crossCheck: { maxDivergenceBps: number; checkAdmissionSec: number };
    switchboard?: { minDelaySec: number; admissionSec: number; maxSlotAge: number; minOracles: number };
    attested?: { minDelaySec: number; admissionSec: number; barLenSec: number };
  };
  redstone: Record<string, unknown>;
  tickers: Record<string, TickerSources>;
};

export type TickerSources = {
  pythFeedId?: string;
  redstoneFeedId?: string;
  versions: Array<{ version: number; validFrom: string; validUntil: string | null; primary: SourceName; check: SourceName | null }>;
};

export type SourceName = "pyth" | "redstone" | "switchboard" | "attested";

/** `PolicyVersionArgs` as the instruction takes it (the builder flattens it next to `index`). */
export type PolicyVersionArgs = {
  validFromTs: bigint;
  validUntilTs: bigint;
  primary: PrintPolicyInput;
  check: PrintPolicyInput;
  maxDivergenceBps: number;
  checkAdmissionSec: number;
};

export const SOURCE = { none: 0, pyth: 1, redstone: 2, switchboard: 3, attested: 4 } as const;
/** Open-ended validity (prints.md §2.1). */
export const I64_MAX = 9_223_372_036_854_775_807n;
/** A RedStone check waits 60 s for all signers inside its 120 s window (prints.md §2.1, D-013). */
export const CHECK_REDSTONE_STRICT_SEC = 60;

/** `primary.open_admission_sec` that admits the opening print until `lock_at`; the engine accepts it only on a Gap Series (prints.md §2.1, `constants.rs` `ADMIT_UNTIL_LOCK`). */
export const ADMIT_UNTIL_LOCK = 0xffff_ffff;

export const ZERO_POLICY: PrintPolicyInput = {
  source: 0, graceSec: 0, feedId: new Uint8Array(32), minDelaySec: 0, barLenSec: 0,
  maxConfBps: 0, maxSlotAge: 0, openAdmissionSec: 0, closeAdmissionSec: 0, strictSec: 0,
};

export function redstoneSigners(sources: PriceSources): Uint8Array[] {
  const list = sources.redstone["signersObserved_2026-09-13"];
  if (!Array.isArray(list) || list.length !== 5) throw new Error("price-sources.json: expected 5 RedStone signers");
  return list.map((hex) => hexBytes(String(hex), 20));
}

export function hexBytes(hex: string, length: number): Uint8Array {
  const clean = hex.replace(/^0x/i, "");
  if (clean.length !== length * 2 || !/^[0-9a-f]+$/i.test(clean)) throw new Error(`expected ${length} hex bytes, got "${hex}"`);
  return Uint8Array.from(clean.match(/../g)!.map((b) => Number.parseInt(b, 16)));
}

/** RedStone data-feed ids are ASCII, left-aligned and zero-padded to 32 bytes (prints.md §2.2). */
export function asciiFeedId(id: string): Uint8Array {
  const bytes = new TextEncoder().encode(id);
  if (bytes.length === 0 || bytes.length > 32) throw new Error(`bad RedStone feed id "${id}"`);
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
}

function unixSec(iso: string): bigint {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms % 1000 !== 0) throw new Error(`bad timestamp "${iso}"`);
  return BigInt(ms / 1000);
}

function policyFor(source: SourceName, ticker: TickerSources, sources: PriceSources, check: boolean): PrintPolicyInput {
  const { pyth, redstone, crossCheck } = sources.defaults;
  if (source === "pyth") {
    if (!ticker.pythFeedId) throw new Error("pyth source without pythFeedId");
    const admission = check ? crossCheck.checkAdmissionSec : pyth.admissionSec;
    return { ...ZERO_POLICY, source: SOURCE.pyth, feedId: hexBytes(ticker.pythFeedId, 32), graceSec: pyth.graceSec, maxConfBps: pyth.maxConfBps, openAdmissionSec: admission, closeAdmissionSec: admission };
  }
  if (source === "redstone") {
    if (!ticker.redstoneFeedId) throw new Error("redstone source without redstoneFeedId");
    const admission = check ? crossCheck.checkAdmissionSec : redstone.admissionSec;
    const strictSec = check ? CHECK_REDSTONE_STRICT_SEC : redstone.strictSec;
    return { ...ZERO_POLICY, source: SOURCE.redstone, feedId: asciiFeedId(ticker.redstoneFeedId), strictSec, openAdmissionSec: admission, closeAdmissionSec: admission };
  }
  return tokenPolicyFor(source, ticker, sources, check);
}

/**
 * Every version of one ticker for one lane, in index order (session-lanes.md §1.2). A Gap version is the ticker's
 * version with `primary.open_admission_sec = ADMIT_UNTIL_LOCK`, so Friday's print can be posted until Sunday 20:00 ET;
 * its check (if any) keeps `check_admission_sec` on both boundaries. Token versions are lane 6b's (`policies-token.ts`).
 */
export function policyVersions(symbol: string, sources: PriceSources, basis: LaneBasis = "regular"): PolicyVersionArgs[] {
  // Token versions come from the `tokenLane` block, not the ticker's session versions.
  if (basis === "token") return tokenPolicyVersions(symbol, sources);
  const ticker = sources.tickers[symbol];
  if (!ticker) throw new Error(`price-sources.json has no ticker ${symbol}`);
  return [...ticker.versions]
    .sort((a, b) => a.version - b.version)
    .map((v, i) => {
      if (v.version !== i + 1) throw new Error(`${symbol}: versions must be 1..n without gaps`);
      const { crossCheck } = sources.defaults;
      const primary = policyFor(v.primary, ticker, sources, false);
      return {
        validFromTs: unixSec(v.validFrom),
        validUntilTs: v.validUntil === null ? I64_MAX : unixSec(v.validUntil),
        primary: basis === "gap" ? { ...primary, openAdmissionSec: ADMIT_UNTIL_LOCK } : primary,
        check: v.check === null ? ZERO_POLICY : policyFor(v.check, ticker, sources, true),
        maxDivergenceBps: v.check === null ? 0 : crossCheck.maxDivergenceBps,
        checkAdmissionSec: v.check === null ? 0 : crossCheck.checkAdmissionSec,
      };
    });
}

const bytesEqual = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((x, i) => x === b[i]);

const POLICY_FIELDS = ["source", "graceSec", "minDelaySec", "barLenSec", "maxConfBps", "maxSlotAge", "openAdmissionSec", "closeAdmissionSec", "strictSec"] as const;

function policyDiff(label: string, onChain: PrintPolicy, want: PrintPolicyInput): string[] {
  const out = POLICY_FIELDS.filter((f) => onChain[f] !== want[f]).map((f) => `${label}.${f}: chain ${onChain[f]} ≠ want ${want[f]}`);
  if (!bytesEqual(onChain.feedId, want.feedId)) out.push(`${label}.feedId differs`);
  return out;
}

/** Field-level differences between a stored version and the wanted one (padding ignored). Empty = identical. */
export function versionDiff(onChain: PolicyVersion, want: PolicyVersionArgs): string[] {
  const out: string[] = [];
  if (onChain.validFromTs !== want.validFromTs) out.push(`validFromTs: chain ${onChain.validFromTs} ≠ want ${want.validFromTs}`);
  if (onChain.validUntilTs !== want.validUntilTs) out.push(`validUntilTs: chain ${onChain.validUntilTs} ≠ want ${want.validUntilTs}`);
  if (onChain.maxDivergenceBps !== want.maxDivergenceBps) out.push(`maxDivergenceBps: chain ${onChain.maxDivergenceBps} ≠ want ${want.maxDivergenceBps}`);
  if (onChain.checkAdmissionSec !== want.checkAdmissionSec) out.push(`checkAdmissionSec: chain ${onChain.checkAdmissionSec} ≠ want ${want.checkAdmissionSec}`);
  return [...out, ...policyDiff("primary", onChain.primary, want.primary), ...policyDiff("check", onChain.check, want.check)];
}
