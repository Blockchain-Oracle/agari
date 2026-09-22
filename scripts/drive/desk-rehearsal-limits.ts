// S21 C6 F (D-126): prove-limits on the fork with the REAL desk-runner key (a copy of the mainnet one). Every check a
// stolen operator key could try is tried, simulated to name the refusal and sent without preflight so a reverted
// transaction exists on the fork; the things the owner alone may do are done and measured; the chain is replayed at
// the end. Called by `desk-rehearsal.ts`; the fork is the only chain it can reach.

import { chainHead, formatTokens, formatUsdc, hashRecord, rawFor, replayChain, valueE6, ZERO_HASH } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { Hash32 } from "@agari/core/types";
import {
  associatedTokenAddress, buy, buyIx, chainNowSec, checkpoint, DESK_MINTS, deskTokenAccounts, forkSetTokenAccount, forkTimeTravel, postReference, postReferenceInstructions, quoteSwap, readDeskEventsOf, readDeskHistory,
  readDeskState, sealedActionsOf, sell, sendForRefusal, swapInstructions, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, tokenBalance, USDC_MAINNET, withdrawAsStrangerIx,
  type DeskMainnetSession, type DeskRpc, type DeskState, type JupiterRoute, type Refusal,
} from "@agari/markets/desk";
import type { RunnerContext } from "../../services/ops/src/actors/desk-runner/types";
import { multiplierOf, refreshMints } from "../../services/ops/src/actors/desk-runner/value";
import { bpsOf, nowSec, sleep, type Evidence, type RehearsalArgs } from "./desk-kit";

type Addr = Parameters<typeof deskTokenAccounts>[0];
type Signer = Parameters<typeof withdrawAsStrangerIx>[0];
const USDC = 1_000_000n;
const DEADLINE_SEC = 120;
const CODE = { IsPaused: 7004, ShadowMode: 7005, OverPerActionCap: 7200, OverDailyCap: 7201, ReferenceStale: 7203, UnknownAttestor: 7207, PremiumTooHigh: 7208, BelowOracleFloor: 7211, NotOwner: 7001 } as const;
const NAME: PreIpoSymbol = "ANTHROPIC";

export interface Limits {
  a: RehearsalArgs;
  evidence: Evidence;
  rpc: DeskRpc;
  ctx: RunnerContext;
  session: DeskMainnetSession;
  owner: Addr;
  operator: Addr;
  desk: Addr;
  chain: DeskState;
  stranger: Signer;
  log: (why: string) => void;
}

const jup = () => (process.env.JUPITER_API_KEY ? { apiKey: process.env.JUPITER_API_KEY } : {});
const hashFor = (step: string): Hash32 => hashRecord({ drive: "desk-rehearsal", step, atSec: nowSec() });
const sigs = (r: Refusal): string[] => (r.landed ? [r.landed.signature] : []);

function expectCode(what: string, r: Refusal, code: number): string {
  const seen = `simulation ${r.simulation.deskCode ?? r.simulation.customCode ?? "?"}${r.landed ? `, landed ${r.landed.deskCode ?? r.landed.customCode ?? "?"} in slot ${r.landed.slot}` : ", not landed"}`;
  if (r.simulation.deskCode !== code || (r.landed && r.landed.deskCode !== code)) throw new Error(`${what}: expected ${code}, saw ${seen}; ${r.simulation.error.split("|").slice(0, 2).join("|")}`);
  return `${what} → agari-desk ${code} (${seen})`;
}

export async function proveLimits(l: Limits): Promise<void> {
  const { evidence, rpc, ctx, session, owner, desk } = l;
  const client = ctx.operator!;
  const attestor = ctx.attestor!;
  await refreshMints(ctx, nowSec());
  const mint = DESK_MINTS[NAME];
  const { deskUsdc, deskToken } = await deskTokenAccounts(desk, mint);
  const chainNow = () => chainNowSec(rpc);
  const state = async () => (await readDeskState(rpc, owner, nowSec()))!;

  const route = async (side: "buy" | "sell", amountIn: bigint): Promise<JupiterRoute> => {
    const quote = await quoteSwap({ inputMint: side === "buy" ? USDC_MAINNET : mint, outputMint: side === "buy" ? mint : USDC_MAINNET, amount: amountIn, ...jup() });
    await sleep(250);
    return swapInstructions({ quote, desk, destinationTokenAccount: side === "buy" ? deskToken : deskUsdc, payer: client.address, ...jup() });
  };
  const buyRefusal = async (step: string, usdcE6: bigint, code: number, deadlineSec?: number): Promise<{ detail: string; signatures: string[] }> => {
    const r = await route("buy", usdcE6);
    const ix = await buyIx({ operator: client.signer, owner, tokenMint: mint, amountIn: usdcE6, minOut: 0n, deadlineSec: deadlineSec ?? (await chainNow()) + DEADLINE_SEC, decisionHash: hashFor(step), swapData: r.swapData, route: r.route });
    const refusal = await sendForRefusal(client, [...r.setupInstructions, ix], { lookupTables: r.lookupTables });
    return { detail: expectCode(`buy $${usdcE6 / USDC} of ${NAME}`, refusal, code), signatures: sigs(refusal) };
  };
  /** The feed's latest values for the name, as the runner would post them. */
  const feedRef = () => {
    const latest = ctx.feed.history(NAME).at(-1);
    const multiplierE12 = multiplierOf(ctx.mints, NAME);
    if (!latest || multiplierE12 === null) throw new Error(`no feed read or multiplier for ${NAME}`);
    return { tokenPriceE8: latest.tokenPriceE8, markPriceE8: latest.markPriceE8, multiplierE12 };
  };
  /** Posts a reference newer than the chain's, at most 5 s ahead of the fork's clock (the program's slack). */
  const post = async (fields: { tokenPriceE8: bigint; markPriceE8: bigint; multiplierE12: bigint }, by = attestor) => {
    const prev = (await state()).refs[mint as string]?.fetchedAtSec ?? 0;
    let now = await chainNow();
    while (prev + 1 > now + 5) {
      await sleep(1_000);
      now = await chainNow();
    }
    return postReference(client, { attestor: by, mint, ...fields, fetchedAtSec: Math.max(now, prev + 1) });
  };

  await evidence.check("F1", "over-cap buy ($600 > $500 per action) → OverPerActionCap", () => buyRefusal("F1", 600n * USDC, CODE.OverPerActionCap));

  await evidence.check("F2", "two $500 buys inside one window → OverDailyCap", async () => {
    const s = await state();
    const remaining = s.remainingDailyCapE6;
    const signatures: string[] = [];
    let note = `window spent ${formatUsdc(s.spentInWindowE6)} of ${formatUsdc(s.dailyCapE6)}`;
    if (remaining >= 500n * USDC) {
      const r = await route("buy", 500n * USDC);
      const first = await buy(client, { owner, mint, amountIn: 500n * USDC, minOut: 0n, deadlineSec: (await chainNow()) + DEADLINE_SEC, decisionHash: hashFor("F2-first"), route: r });
      signatures.push(first.signature);
      note += `; first $500 buy landed (seq ${first.sealed.seq}, ${first.bytes} B, ${first.unitsConsumed} CU)`;
    }
    const second = await buyRefusal("F2-second", 500n * USDC, CODE.OverDailyCap);
    return { detail: `${note}; ${second.detail}`, signatures: [...signatures, ...second.signatures] };
  });

  await evidence.check("F3", "reference posted 20 % UNDER the pool, then a buy → BelowOracleFloor (the band demands more than the pool gives)", async () => {
    const f = feedRef();
    const low = await post({ tokenPriceE8: (f.tokenPriceE8 * 80n) / 100n, markPriceE8: (f.markPriceE8 * 80n) / 100n, multiplierE12: f.multiplierE12 });
    const refusal = await buyRefusal("F3", 100n * USDC, CODE.BelowOracleFloor);
    const restored = await post(f);
    return { detail: `reference ${formatUsdc(f.tokenPriceE8 / 100n)} → ${formatUsdc((f.tokenPriceE8 * 80n) / 10_000n)}; ${refusal.detail}; restored`, signatures: [low.signature, ...refusal.signatures, restored.signature] };
  });

  await evidence.check("F4", "mark far under the token (50 %) → PremiumTooHigh at a 3,000 bps ceiling", async () => {
    const f = feedRef();
    const rich = await post({ tokenPriceE8: f.tokenPriceE8, markPriceE8: f.markPriceE8 / 2n, multiplierE12: f.multiplierE12 });
    const refusal = await buyRefusal("F4", 100n * USDC, CODE.PremiumTooHigh);
    const restored = await post(f);
    return { detail: `premium ${bpsOf(f.tokenPriceE8 - f.markPriceE8 / 2n, f.markPriceE8 / 2n)} bps > 3,000; ${refusal.detail}; restored`, signatures: [rich.signature, ...refusal.signatures, restored.signature] };
  });

  await evidence.check("F5", "owner sets mode 0 (practice) → a buy is ShadowMode; mode restored", async () => {
    const set = await session.setMode("practice");
    const refusal = await buyRefusal("F5", 100n * USDC, CODE.ShadowMode);
    const back = await session.setMode("on_its_own");
    return { detail: refusal.detail, signatures: [set.signature, ...refusal.signatures, back.signature] };
  });

  await evidence.check("F6", "owner pauses → a buy is IsPaused; owner unpauses", async () => {
    const paused = await session.pause();
    const refusal = await buyRefusal("F6", 100n * USDC, CODE.IsPaused);
    const resumed = await session.unpause();
    return { detail: refusal.detail, signatures: [paused.signature, ...refusal.signatures, resumed.signature] };
  });

  await evidence.check("F7", "a stranger-signed attestation → UnknownAttestor", async () => {
    const f = feedRef();
    const ixs = await postReferenceInstructions({ attestor: l.stranger, payer: client.signer, mint, clusterTag: client.clusterTag, ...f, fetchedAtSec: await chainNow() });
    const refusal = await sendForRefusal(client, ixs);
    return { detail: expectCode(`post by ${l.stranger.address.slice(0, 8)}…`, refusal, CODE.UnknownAttestor), signatures: sigs(refusal) };
  });

  await evidence.check("F8", "owner_withdraw signed by the desk-runner, aimed at the owner's desk → refused (NotOwner or the seeds constraint before it)", async () => {
    // The thief has an account to be paid into (Anchor deserialises every account before it checks a constraint).
    await forkSetTokenAccount(l.a.rpcUrl, { owner: client.address, mint: USDC_MAINNET, amount: 1n, tokenProgram: TOKEN_PROGRAM });
    const ix = await withdrawAsStrangerIx(client.signer, owner, USDC_MAINNET, 1n * USDC);
    const refusal = await sendForRefusal(client, [ix]);
    const code = refusal.simulation.deskCode ?? refusal.simulation.customCode;
    if (code === null) throw new Error(`no custom code: ${refusal.simulation.error}`);
    const which = code === CODE.NotOwner ? "agari-desk 7001 NotOwner" : code === 2006 ? "Anchor 2006 ConstraintSeeds (the desk PDA is derived from the signer, so a stranger never reaches has_one)" : `custom ${code}`;
    return { detail: `${which}${refusal.landed ? `, landed ${refusal.landed.customCode} in slot ${refusal.landed.slot}` : ""}`, signatures: sigs(refusal) };
  });

  await evidence.check("F9", "a sell of a DISALLOWED name succeeds (the desk can always exit); the owner then allows it again", async () => {
    const before = await state();
    const held = before.tokens.find((t) => t.mint === mint);
    if (!held || held.raw === 0n) throw new Error(`the desk holds no ${NAME}`);
    // A sell counts against the caps too (at the larger of what comes back and the attested value), so it is sized
    // inside what is left of the day and of one action, with headroom for the price moving between quote and send.
    const f = feedRef();
    const heldE6 = valueE6(held.raw, f.multiplierE12, f.tokenPriceE8);
    const roomE6 = [heldE6 / 4n, (before.remainingDailyCapE6 * 9n) / 10n, (before.perActionCapE6 * 9n) / 10n].reduce((x, y) => (x < y ? x : y));
    const amountIn = rawFor(roomE6, f.multiplierE12, f.tokenPriceE8);
    if (amountIn <= 0n) throw new Error(`no room to sell: held ${formatUsdc(heldE6)}, left today ${formatUsdc(before.remainingDailyCapE6)}`);
    const off = await session.disallowToken(mint);
    const r = await route("sell", amountIn);
    const sold = await sell(client, { owner, mint, amountIn, minOut: 0n, deadlineSec: (await chainNow()) + DEADLINE_SEC, decisionHash: hashFor("F9"), route: r });
    const after = await state();
    const event = sold.events.find((e) => e.name === "Sold");
    if (!event || event.name !== "Sold") throw new Error("no Sold event");
    if ((held.raw - (after.tokens.find((t) => t.mint === mint)?.raw ?? 0n)) !== amountIn) throw new Error("the gross amount did not leave");
    const on = await session.allowTokens([mint]);
    return { detail: `${NAME} disallowed (enabled=${after.tokens.find((t) => t.mint === mint)?.enabled}); sold ${formatTokens(amountIn)} raw (≈ ${formatUsdc(roomE6)}) → ${formatUsdc(event.data.usdcOut)} USDC, counted ${formatUsdc(event.data.countedUsdc)}, seq ${sold.sealed.seq}, ${sold.bytes} B; allowed again`, signatures: [off.signature, sold.signature, on.signature] };
  });

  await evidence.check("F10", "operator_checkpoint advances seq and head", async () => {
    const before = await state();
    const hash = hashFor("F10");
    const sealed = await checkpoint(client, { owner, deadlineSec: (await chainNow()) + DEADLINE_SEC, decisionHash: hash });
    const expected = chainHead(before.head, sealed.sealed.seq, hash);
    if (sealed.sealed.seq !== before.seq + 1n || sealed.sealed.head.toLowerCase() !== expected.toLowerCase()) throw new Error(`seq ${sealed.sealed.seq}, head ${sealed.sealed.head} ≠ ${expected}`);
    return { detail: `seq ${before.seq} → ${sealed.sealed.seq}, head ${expected.slice(0, 12)}…`, signatures: [sealed.signature] };
  });

  await evidence.check("F11", "owner_withdraw(u64::MAX) credits only the owner: USDC whole, the name net of the 100 bps fee", async () => {
    const before = await state();
    const ownerUsdc = await associatedTokenAddress(owner, USDC_MAINNET, TOKEN_PROGRAM);
    const ownerName = await associatedTokenAddress(owner, mint, TOKEN_2022_PROGRAM);
    const usdcBefore = (await tokenBalance(rpc, ownerUsdc)) ?? 0n;
    const nameBefore = (await tokenBalance(rpc, ownerName)) ?? 0n;
    const w1 = await session.withdraw({ mint: USDC_MAINNET });
    const w2 = await session.withdraw({ mint });
    const usdcAfter = (await tokenBalance(rpc, ownerUsdc)) ?? 0n;
    const nameAfter = (await tokenBalance(rpc, ownerName)) ?? 0n;
    const heldName = before.tokens.find((t) => t.mint === mint)?.raw ?? 0n;
    const fee = (heldName * 100n + 9_999n) / 10_000n;
    const after = await state();
    if (usdcAfter - usdcBefore !== before.usdc.raw || after.usdc.raw !== 0n) throw new Error(`usdc: owner +${usdcAfter - usdcBefore}, desk had ${before.usdc.raw}, desk now ${after.usdc.raw}`);
    if (nameAfter - nameBefore !== heldName - fee) throw new Error(`${NAME}: owner +${nameAfter - nameBefore}, desk had ${heldName}, fee ${fee}`);
    const events = [...(await readDeskEventsOf(rpc, w1.signature as never)), ...(await readDeskEventsOf(rpc, w2.signature as never))].filter((e) => e.name === "Withdrawn");
    return { detail: `USDC ${formatUsdc(before.usdc.raw)} → owner (+${formatUsdc(usdcAfter - usdcBefore)}); ${NAME} ${formatTokens(heldName)} raw → owner +${formatTokens(nameAfter - nameBefore)} (fee ${formatTokens(fee)} withheld); ${events.length} Withdrawn events; the owner's ATAs are the only destinations the program knows`, signatures: [w1.signature, w2.signature] };
  });

  await evidence.check("F12", "surfnet_timeTravel +20 min with no re-post → a buy is ReferenceStale", async () => {
    const from = await chainNow();
    const travelled = await forkTimeTravel(l.a.rpcUrl, from + 20 * 60);
    await sleep(1_500);
    const now = await chainNow();
    if (now < from + 19 * 60) throw new Error(`the clock moved only ${now - from} s`);
    const age = now - ((await state()).refs[mint as string]?.fetchedAtSec ?? 0);
    const refusal = await buyRefusal("F12", 100n * USDC, CODE.ReferenceStale, now + DEADLINE_SEC);
    return { detail: `clock ${from} → ${now} (+${now - from} s, slot ${travelled.absoluteSlot}); reference ${age} s old; ${refusal.detail}`, signatures: refusal.signatures };
  });

  await evidence.check("F13", "seq is gap-free and the head replays from genesis over every sealed action", async () => {
    const s = await state();
    const history = await readDeskHistory(rpc, desk, { limit: 100 });
    const sealed = history.flatMap((h) => sealedActionsOf(h.events).map((x) => ({ ...x, signature: h.signature }))).sort((x, y) => Number(x.seq - y.seq));
    sealed.forEach((x, i) => {
      if (x.seq !== BigInt(i + 1)) throw new Error(`gap: sealed seq ${x.seq} at position ${i + 1}`);
    });
    if (BigInt(sealed.length) !== s.seq) throw new Error(`${sealed.length} sealed actions in history, desk seq ${s.seq}`);
    const replayed = replayChain(ZERO_HASH, 1n, sealed.map((x) => x.decisionHash as Hash32));
    if (replayed.toLowerCase() !== s.head.toLowerCase()) throw new Error(`replayed ${replayed} ≠ chain ${s.head}`);
    const failed = history.filter((h) => h.failed).length;
    return { detail: `${sealed.length} sealed actions (${sealed.map((x) => x.kind[0]).join("")}), seq 1..${s.seq} contiguous, head ${s.head.slice(0, 12)}… replayed from genesis; ${history.length} transactions on the desk, ${failed} failed (the refusals above)` };
  });
}
