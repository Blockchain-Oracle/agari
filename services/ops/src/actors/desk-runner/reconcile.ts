/**
 * Is this still our desk, and does the chain agree with the database? (Shijima `wake.ts` step 1 + `reconcile.ts`.)
 * Live: the desk is read; an unknown send is settled by its signature or by the sealed hash in the desk's history;
 * a chain ahead of the record is explained by sealed actions the record knows, or the desk stops for attention; a
 * held name whose account is frozen or whose mint is paused stops it too. Then balances are compared with the last
 * snapshot plus the desk's own confirmed actions: anything left over came from outside (the owner adding or taking
 * money) and moves the loss-limit baseline, never the loss. Practice: the paper ledger is the state.
 */
import { MIN_TRADE_E6 } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { DeskRow } from "@agari/db";
import { readDeskEventsOf, readDeskHistory, readDeskState, sealedActionsOf, signatureOutcome } from "@agari/markets/desk";
import { errorText } from "../../runtime/env";
import { loadPaper, paperPositions } from "./paper";
import type { DeskStanding, RunnerContext } from "./types";

/** A send whose deadline passed this long ago without any status can never land. */
const NEVER_LANDS_AFTER_SEC = 120;

export interface OutsideChange {
  /** `USDC` or a name. */
  asset: string;
  /** Positive arrived, negative left; base units. */
  delta: bigint;
  /** The same change in USDC E6 at the valuation price; not a real number when `priced` is false. */
  valueE6: bigint;
  priced: boolean;
}

export interface Reconciled {
  standing: DeskStanding;
  /** Why the desk needs attention, or null. */
  trouble: string | null;
  changes: OutsideChange[];
  /** Cash of at least one trade arrived from outside since the last snapshot: an event wake. */
  depositSeen: boolean;
}

/** What the balances should be now: the last snapshot plus and minus the desk's own confirmed fills since it. */
export function findOutsideChanges(
  previous: { cashE6: bigint; positions: Record<string, bigint> },
  fillsSince: readonly { kind: string; symbol: string | null; amountIn: bigint; amountOut: bigint }[],
  current: { cashE6: bigint; positions: Record<string, bigint> },
  priceE8: Record<string, (raw: bigint) => bigint | null>,
): OutsideChange[] {
  const expected = { cashE6: previous.cashE6, positions: { ...previous.positions } };
  for (const f of fillsSince) {
    if (!f.symbol) continue;
    const held = expected.positions[f.symbol] ?? 0n;
    if (f.kind === "buy") {
      expected.cashE6 -= f.amountIn;
      expected.positions[f.symbol] = held + f.amountOut;
    } else if (f.kind === "sell") {
      expected.cashE6 += f.amountOut;
      expected.positions[f.symbol] = held - f.amountIn;
    }
  }
  const changes: OutsideChange[] = [];
  const cashDelta = current.cashE6 - expected.cashE6;
  if (cashDelta !== 0n) changes.push({ asset: "USDC", delta: cashDelta, valueE6: cashDelta, priced: true });
  for (const symbol of new Set([...Object.keys(expected.positions), ...Object.keys(current.positions)])) {
    const delta = (current.positions[symbol] ?? 0n) - (expected.positions[symbol] ?? 0n);
    if (delta === 0n) continue;
    const value = priceE8[symbol]?.(delta) ?? null;
    changes.push({ asset: symbol, delta, valueE6: value ?? 0n, priced: value !== null });
  }
  return changes;
}

export const netFlowE6 = (changes: readonly OutsideChange[]): bigint => changes.reduce((sum, c) => sum + c.valueE6, 0n);
export const allPriced = (changes: readonly OutsideChange[]): boolean => changes.every((c) => c.priced);

/**
 * Where the loss-limit baseline moves after money came in or went out: it SCALES, so the loss stays exactly where it
 * was. A first deposit, or a baseline of nothing, starts afresh at what the desk is worth now.
 */
export function scaledBaseline(baselineE6: bigint, totalNowE6: bigint, netFlowE6: bigint): bigint {
  if (netFlowE6 === 0n) return baselineE6;
  const before = totalNowE6 - netFlowE6;
  if (before <= 0n || baselineE6 <= 0n) return totalNowE6;
  return (baselineE6 * totalNowE6) / before;
}

/** Settles every action the runner sent without seeing confirmed, from the chain, never from memory. */
async function settleUnresolved(ctx: RunnerContext, desk: DeskRow, address: string, nowSec: number): Promise<{ stillUnknown: number; note: string[] }> {
  const rpc = ctx.rpc!;
  const note: string[] = [];
  let stillUnknown = 0;
  for (const a of await ctx.q.unresolvedActions(desk.id)) {
    const record = await ctx.q.getRecord({ deskId: desk.id, seq: a.recordSeq });
    const hash = record?.record.recordHash ?? null;
    const confirm = async (signature: string, chainSeq: bigint, head: string) => {
      await ctx.q.resolveAction({ id: a.id, state: "confirmed", signature, chainSeq: Number(chainSeq), nowSec });
      await ctx.q.markSealed({ deskId: desk.id, seq: a.recordSeq, signature, chainSeq: Number(chainSeq) });
      await ctx.q.setChainPosition({ deskId: desk.id, chainSeq: Number(chainSeq), chainHead: head, nowSec });
      note.push(`record ${a.recordSeq} landed in ${signature.slice(0, 8)}`);
    };
    try {
      if (a.signature) {
        const fate = await signatureOutcome(rpc, a.signature);
        if (fate.kind === "confirmed") {
          const sealed = sealedActionsOf(await readDeskEventsOf(rpc, a.signature as never)).find((s) => hash && s.decisionHash.toLowerCase() === hash.toLowerCase());
          if (sealed) await confirm(a.signature, sealed.seq, sealed.head);
          else await ctx.q.resolveAction({ id: a.id, state: "confirmed", signature: a.signature, nowSec });
          continue;
        }
        if (fate.kind === "failed") {
          await ctx.q.resolveAction({ id: a.id, state: "reverted", error: "the chain recorded the transaction as failed", nowSec });
          continue;
        }
      } else if (hash) {
        // Died between signing and confirming: the sealed hash in the desk's own history is the receipt.
        const history = await readDeskHistory(rpc, address as never, { limit: 20 });
        const hit = history.flatMap((h) => sealedActionsOf(h.events).map((s) => ({ ...s, signature: h.signature }))).find((s) => s.decisionHash.toLowerCase() === hash.toLowerCase());
        if (hit) {
          await confirm(hit.signature, hit.seq, hit.head);
          continue;
        }
      }
      if (a.deadlineSec !== null && nowSec > a.deadlineSec + NEVER_LANDS_AFTER_SEC) {
        await ctx.q.resolveAction({ id: a.id, state: "refused", error: "never landed: its deadline passed with no trace on chain", nowSec });
        note.push(`record ${a.recordSeq} never landed`);
        continue;
      }
      stillUnknown += 1;
    } catch (error) {
      stillUnknown += 1;
      note.push(`record ${a.recordSeq} still unknown: ${errorText(error)}`);
    }
  }
  return { stillUnknown, note };
}

async function reconcileLive(ctx: RunnerContext, desk: DeskRow, nowSec: number, say: (line: string) => void): Promise<Reconciled> {
  if (!ctx.rpc || !desk.address) throw new Error("no RPC to read the desk with");
  const chain = await readDeskState(ctx.rpc, desk.owner as never, nowSec);
  if (!chain) throw new Error("the desk account was not found on chain");
  const positions: Record<string, bigint> = {};
  const frozen: Record<string, boolean> = {};
  for (const t of chain.tokens) {
    if (!t.symbol) continue;
    positions[t.symbol] = t.raw;
    frozen[t.symbol] = t.frozen;
  }
  const standing: DeskStanding = { kind: "live", chain, positions, frozen, cashE6: chain.usdc.raw };
  const settled = await settleUnresolved(ctx, desk, desk.address, nowSec);
  for (const line of settled.note) say(line);
  if (settled.stillUnknown === 0) ctx.holding.delete(desk.id);
  else ctx.holding.add(desk.id);

  let trouble: string | null = null;
  if (ctx.operator && chain.operator !== ctx.operator.address) trouble = chain.operator ? "the desk names a different operator" : "you revoked the operator";
  const known = (await ctx.q.getDeskById(desk.id))?.chainSeq ?? desk.chainSeq;
  const chainSeq = Number(chain.seq);
  if (!trouble && chainSeq > known) {
    // Every sealed action between the record's position and the chain's must be one this desk wrote.
    const history = await readDeskHistory(ctx.rpc, chain.address, { limit: 50 });
    const sealed = history.flatMap((h) => sealedActionsOf(h.events).map((s) => ({ ...s, signature: h.signature }))).filter((s) => Number(s.seq) > known && Number(s.seq) <= chainSeq);
    const explained = sealed.length === chainSeq - known && (await Promise.all(sealed.map(async (s) => ({ s, seq: await ctx.q.recordSeqByHash({ deskId: desk.id, hash: s.decisionHash }) })))).every(({ seq }) => seq !== null);
    if (explained) {
      for (const s of sealed) {
        const seq = await ctx.q.recordSeqByHash({ deskId: desk.id, hash: s.decisionHash });
        if (seq !== null) await ctx.q.markSealed({ deskId: desk.id, seq, signature: s.signature, chainSeq: Number(s.seq) });
      }
      await ctx.q.setChainPosition({ deskId: desk.id, chainSeq, chainHead: chain.head, nowSec });
      say(`chain at ${chainSeq}, record caught up from ${known}`);
    } else trouble = `the chain is at ${chainSeq} and the record at ${known}: ${chainSeq - known} action(s) this desk cannot explain`;
  } else if (!trouble && chainSeq < known) trouble = `the chain is at ${chainSeq}, behind the record at ${known}`;
  if (!trouble) {
    const stuck = chain.tokens.find((t) => t.symbol && t.raw > 0n && (t.frozen || ctx.mints?.byMint[t.mint as string]?.paused === true));
    if (stuck) trouble = stuck.frozen ? `the desk's ${stuck.symbol} account is frozen by the issuer` : `PreStocks has paused transfers of ${stuck.symbol}`;
  }
  return { standing, trouble, ...(await outsideChanges(ctx, desk, standing, nowSec)) };
}

async function reconcilePractice(ctx: RunnerContext, desk: DeskRow, nowSec: number): Promise<Reconciled> {
  const ledger = await loadPaper(ctx.q, desk.id);
  if (!ledger) throw new Error("the practice desk has no paper ledger");
  const standing: DeskStanding = { kind: "practice", positions: paperPositions(ledger), cashE6: ledger.cashE6 };
  return { standing, trouble: null, ...(await outsideChanges(ctx, desk, standing, nowSec)) };
}

/** Balances against the last snapshot plus the desk's own fills since; the price of a name is its last snapshot price. */
async function outsideChanges(ctx: RunnerContext, desk: DeskRow, standing: DeskStanding, nowSec: number): Promise<{ changes: OutsideChange[]; depositSeen: boolean }> {
  const previous = await ctx.q.latestSnapshot(desk.id);
  if (!previous) return { changes: [], depositSeen: standing.cashE6 >= MIN_TRADE_E6 && desk.createdAtSec < nowSec - 60 };
  const fills = (await ctx.q.confirmedActionsSince({ deskId: desk.id, sinceSec: previous.takenAtSec })).map((a) => ({ kind: a.kind, symbol: a.symbol, amountIn: BigInt(a.amountIn ?? "0"), amountOut: BigInt(a.amountOut ?? a.expectedOut ?? "0") }));
  const priceOf: Record<string, (raw: bigint) => bigint | null> = {};
  for (const h of previous.holdings) {
    const price = BigInt(h.priceE8);
    const raw = BigInt(h.raw);
    priceOf[h.symbol] = (delta) => (price > 0n && raw > 0n ? (delta * BigInt(h.valueE6)) / raw : null);
  }
  const changes = findOutsideChanges(
    { cashE6: BigInt(previous.usdcE6), positions: Object.fromEntries(previous.holdings.map((h) => [h.symbol, BigInt(h.raw)])) },
    fills,
    { cashE6: standing.cashE6, positions: standing.positions },
    priceOf,
  );
  const cash = changes.find((c) => c.asset === "USDC");
  return { changes, depositSeen: Boolean(cash && cash.delta >= MIN_TRADE_E6) };
}

export async function reconcile(ctx: RunnerContext, desk: DeskRow, nowSec: number, say: (line: string) => void): Promise<Reconciled> {
  return desk.mode === "practice" || !desk.address ? reconcilePractice(ctx, desk, nowSec) : reconcileLive(ctx, desk, nowSec, say);
}

export const symbolsHeld = (standing: DeskStanding): PreIpoSymbol[] => (Object.keys(standing.positions) as PreIpoSymbol[]).filter((s) => (standing.positions[s] ?? 0n) > 0n);
