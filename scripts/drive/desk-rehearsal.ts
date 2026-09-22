#!/usr/bin/env -S pnpm exec tsx
// S21 C6 (D-126): the whole desk rehearsed on a Surfpool fork of Solana mainnet, in numbered checks, before one real
// lamport is spent. A fund and prewarm · B deploy + init-desk · C the owner opens, allows the eight names, deposits ·
// D a signed AI Labs mandate goes live in the LOCAL Postgres · E one live wake through the runner's own functions:
// PreStocks read, Jupiter quote, the timing answer, the reference posted, `operator_buy` through the Jupiter CPI,
// gross vs net measured · F prove-limits with the real desk-runner key (`desk-rehearsal-limits.ts`) · G evidence.
// The fork is the only chain touched (`assertLocalRpc`); the desk-runner and price-attestor are copies of the mainnet
// keys, the owner is fresh for the run. Nothing here sends to devnet or mainnet.
//
// Start the fork first (never leave it bound; kill it by PID when done):
//   NO_DNA=1 surfpool start --rpc-url "https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY" --port 8999 --ws-port 8998 --no-tui --no-studio --airdrop-amount 0
// Run: pnpm drive:desk-rehearsal [--rpc-url http://127.0.0.1:8999] [--ws-url ws://127.0.0.1:8998] [--out .agari/desk-rehearsal]
//        [--model-stub ACT_NOW|WAIT|DECLINE|none] [--phases A,B,C,D,E,F,G] [--skip-deploy]
// Needs: DATABASE_URL (local Postgres), HELIUS_API_KEY (the fork's datasource), JUPITER_API_KEY (quotes), the mainnet
// role keys in ~/.config/agari/mainnet, `pnpm anchor:build` done (anchor/target/deploy/agari_desk.so).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLUSTER_ID } from "@agari/core/constants";
import { chainHead, checkMandate, deskMandateText, formatTokens, formatUsdc, mandateFingerprint, mandateSymbols, mandateToWire, presetMandate } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS } from "@agari/core/market";
import { deskQueries, getDb, isDbConfigured, type DeskRow } from "@agari/db";
import { keypairSigner } from "@agari/markets/deploy";
import {
  associatedTokenAddress, createDeskMainnetSession, createDeskRpc, DESK_MINTS, deskAddress, deskTokenAccounts, forkAirdrop, forkSetTokenAccount, prewarmRoute, quoteSwap, readDeskEventsOf,
  readDeskInitPlan, readDeskState, refreshRoute, sealedActionsOf, swapInstructions, TOKEN_PROGRAM, tokenBalance, USDC_MAINNET, type DeskState,
} from "@agari/markets/desk";
import { createRunnerContext } from "../../services/ops/src/actors/desk-runner";
import { readDeskRunnerEnv } from "../../services/ops/src/actors/desk-runner/env";
import type { RunnerContext } from "../../services/ops/src/actors/desk-runner/types";
import { feedWarm } from "../../services/ops/src/actors/desk-runner/value";
import { wakeDesk } from "../../services/ops/src/actors/desk-runner/wake";
import { createPreStocksSpotFeed } from "../../services/ops/src/prices/prestocks-spot";
import { bpsOf, deployProgram, ensureForkKeys, Evidence, nowSec, rehearsalArgs, runInitDesk, sha256File, signOwnerText, sleep, verifyOwnerText } from "./desk-kit";
import { proveLimits, type Limits } from "./desk-rehearsal-limits";

type Addr = Parameters<typeof deskAddress>[0];
const SOL = 1_000_000_000n;
const USDC = 1_000_000n;
const PER_ACTION_E6 = 500n * USDC;
const DAILY_E6 = 1_000n * USDC;
const DEPOSIT_E6 = 1_000n * USDC;
const OWNER_USDC_E6 = 2_000n * USDC;
const MAX_PREMIUM_BPS = 3_000;

const a = rehearsalArgs();
const runId = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const keys = ensureForkKeys(a, runId);
const evidence = new Evidence(join(a.outDir, "evidence.json"), { runId, rpcUrl: a.rpcUrl, cluster: "localnet (Surfpool mainnet fork)", startedAt: new Date().toISOString() });
const rpc = createDeskRpc(a.rpcUrl);
const owner = keys.pubkey(keys.ownerRole) as Addr;
const operator = keys.pubkey("desk-runner") as Addr;
const attestor = keys.pubkey("price-attestor") as Addr;
const deployer = keys.pubkey("deployer") as Addr;
const desk = await deskAddress(owner);
const log = (why: string) => console.log(`     · ${why}`);
console.log(`desk-rehearsal ${runId} on ${a.rpcUrl}\n  deployer ${deployer}\n  owner    ${owner} (fresh)\n  operator ${operator} (desk-runner, mainnet key copy)\n  attestor ${attestor} (price-attestor, mainnet key copy)\n  desk PDA ${desk}\n  evidence ${evidence.path}`);
evidence.fact("keys", { deployer, owner, operator, attestor, desk, keysDir: keys.dir });

// ---------------------------------------------------------------------------------------------- A fund and prewarm
if (a.phases.has("A")) {
  await evidence.check("A1", "the fork answers and is a mainnet fork", async () => {
    const [slot, hash, version] = await Promise.all([rpc.getSlot().send(), rpc.getGenesisHash().send(), rpc.getVersion().send()]);
    if (hash !== "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d") throw new Error(`genesis ${hash} is not mainnet's`);
    return { detail: `slot ${slot}, mainnet genesis, ${JSON.stringify(version)}` };
  });
  await evidence.check("A2", "airdrops: deployer, owner, desk-runner, price-attestor", async () => {
    const sigs: string[] = [];
    for (const [who, lamports] of [[deployer, 10n * SOL], [owner, 5n * SOL], [operator, 5n * SOL], [attestor, 2n * SOL]] as const) sigs.push(await forkAirdrop(rpc, who, lamports));
    return { detail: "10 / 5 / 5 / 2 SOL", signatures: sigs };
  });
  await evidence.check("A3", "the owner holds 2,000 USDC (surfnet_setTokenAccount)", async () => {
    await forkSetTokenAccount(a.rpcUrl, { owner, mint: USDC_MAINNET, amount: OWNER_USDC_E6, tokenProgram: TOKEN_PROGRAM });
    const ata = await associatedTokenAddress(owner, USDC_MAINNET, TOKEN_PROGRAM);
    const balance = await tokenBalance(rpc, ata);
    if (balance !== OWNER_USDC_E6) throw new Error(`owner USDC is ${balance}`);
    return { detail: `${ata} = ${formatUsdc(balance)} USDC` };
  });
  await evidence.check("A4", "Jupiter routes prewarmed: USDC→ANTHROPIC and USDC→OPENAI at $50 and $500", async () => {
    const notes: string[] = [];
    for (const symbol of ["ANTHROPIC", "OPENAI"] as const) {
      for (const usdc of [50n * USDC, 500n * USDC]) {
        const quote = await quoteSwap({ inputMint: USDC_MAINNET, outputMint: DESK_MINTS[symbol], amount: usdc, ...(process.env.JUPITER_API_KEY ? { apiKey: process.env.JUPITER_API_KEY } : {}) });
        const { deskUsdc, deskToken } = await deskTokenAccounts(desk, DESK_MINTS[symbol]);
        const route = await swapInstructions({ quote, desk, destinationTokenAccount: deskToken, payer: operator, ...(process.env.JUPITER_API_KEY ? { apiKey: process.env.JUPITER_API_KEY } : {}) });
        // The desk and its two accounts do not exist until C opens it: those three may be missing, nothing else may.
        const warm = await prewarmRoute(rpc, route, [desk, deskUsdc, deskToken]);
        notes.push(`${symbol} $${usdc / USDC}: out ${formatTokens(quote.outAmount)} via ${quote.routeLabels.join(">")}, ${route.accountCount} accounts + ${route.setupInstructions.length} setup, ${warm.tables} ALT(s) / ${warm.entries} entries, missing ${warm.missing}`);
        if (warm.missing > 0) throw new Error(notes.at(-1));
        await sleep(300);
      }
    }
    return { detail: notes.join("; ") };
  });
}

// ---------------------------------------------------------------------------------------------- B deploy + init
const addressesPath = join(a.outDir, "addresses.fork.json");
if (a.phases.has("B")) {
  await evidence.check("B1", "agari-desk deployed to the fork (solana program deploy --use-rpc)", async () => {
    const before = await readDeskInitPlan(rpc);
    if (before.programDeployed && (a.skipDeploy || before.upgradeAuthority === deployer)) return { detail: `already deployed, upgrade authority ${before.upgradeAuthority}; so sha256 ${sha256File(a.programSo)}` };
    const { signature } = deployProgram(a, keys);
    const after = await readDeskInitPlan(rpc);
    if (!after.programDeployed || after.upgradeAuthority !== deployer) throw new Error(`deployed but authority is ${after.upgradeAuthority}`);
    return { detail: `program ${after.programId}, upgrade authority ${deployer}, so sha256 ${sha256File(a.programSo)}`, signatures: [signature] };
  });
  await evidence.check("B2", "init-desk.ts --cluster localnet: DeskConfig + 8 DeskRefs (ensure-style, second run creates nothing)", async () => {
    const first = runInitDesk(a, addressesPath);
    const second = runInitDesk(a, addressesPath);
    const record = JSON.parse(readFileSync(addressesPath, "utf8")) as { programs: { agari_desk: { config: string; configInitSignature?: string; references: Record<string, { address: string; initSignature?: string }> } } };
    const plan = await readDeskInitPlan(rpc);
    if (!plan.config.exists || plan.references.some((r) => !r.exists)) throw new Error("config or a reference is still missing");
    const created = [record.programs.agari_desk.configInitSignature, ...Object.values(record.programs.agari_desk.references).map((r) => r.initSignature)].filter((s): s is string => Boolean(s));
    const secondCreated = /spent 0\.000000000/.test(second);
    if (!secondCreated) throw new Error(`the second run spent something:\n${second.split("\n").slice(-2).join("\n")}`);
    return { detail: `config ${record.programs.agari_desk.config}, ${plan.references.length} references; second run spent 0 SOL; first run: ${first.split("\n").at(-1)}`, signatures: created };
  });
}

// ---------------------------------------------------------------------------------------------- C the owner opens
const ownerSigner = await keypairSigner(keys.secret(keys.ownerRole));
const session = createDeskMainnetSession({ signer: ownerSigner, rpcUrl: a.rpcUrl });
let chain: DeskState | null = null;
if (a.phases.has("C")) {
  await evidence.check("C1", "owner_open_desk: $500 per action, $1,000 a day, 3,000 bps, on its own", async () => {
    const r = await session.openDesk({ operator, perActionCapE6: PER_ACTION_E6, dailyCapE6: DAILY_E6, maxPremiumBps: MAX_PREMIUM_BPS, mode: "on_its_own" });
    return { detail: `desk ${desk}`, signatures: [r.signature] };
  });
  await evidence.check("C2", "owner_allow_token × 8 in one transaction", async () => {
    const r = await session.allowTokens(PRE_IPO_SYMBOLS.map((s) => DESK_MINTS[s]));
    return { detail: PRE_IPO_SYMBOLS.join(", "), signatures: [r.signature] };
  });
  await evidence.check("C3", "owner_deposit 1,000 USDC", async () => {
    const ownerUsdc = await associatedTokenAddress(owner, USDC_MAINNET, TOKEN_PROGRAM);
    const r = await session.deposit({ mint: USDC_MAINNET, ownerToken: ownerUsdc, amount: DEPOSIT_E6 });
    return { detail: `${formatUsdc(DEPOSIT_E6)} USDC from ${ownerUsdc}`, signatures: [r.signature] };
  });
  await evidence.check("C4", "the Desk reads back: fields, nine token accounts, seq 0, genesis head", async () => {
    chain = await readDeskState(rpc, owner, nowSec());
    if (!chain) throw new Error("no desk");
    const problems: string[] = [];
    if (chain.operator !== operator) problems.push(`operator ${chain.operator}`);
    if (chain.perActionCapE6 !== PER_ACTION_E6 || chain.dailyCapE6 !== DAILY_E6) problems.push("caps");
    if (chain.maxPremiumBps !== MAX_PREMIUM_BPS || chain.mode !== "on_its_own" || chain.paused) problems.push("premium/mode/paused");
    if (chain.seq !== 0n || !/^0x0{64}$/.test(chain.head)) problems.push(`seq ${chain.seq} head ${chain.head}`);
    if (!chain.usdc.exists || chain.usdc.raw !== DEPOSIT_E6) problems.push(`usdc ${chain.usdc.raw}`);
    if (chain.tokens.length !== 8 || chain.tokens.some((t) => !t.exists || !t.enabled)) problems.push(`tokens ${chain.tokens.filter((t) => t.exists).length}/8 exist`);
    if (problems.length) throw new Error(problems.join("; "));
    return { detail: `operator ${chain.operator}, caps ${formatUsdc(chain.perActionCapE6)}/${formatUsdc(chain.dailyCapE6)}, ${chain.maxPremiumBps} bps, ${chain.mode}, usdc ${formatUsdc(chain.usdc.raw)}, 1 + 8 token accounts, seq 0` };
  });
}

// ---------------------------------------------------------------------------------------------- D the mandate
if (!isDbConfigured()) throw new Error("DATABASE_URL is not set: the rehearsal needs the local Postgres");
const db = getDb()!;
const q = deskQueries(db);
const mandate = presetMandate("ailabs", { maxPremiumBps: MAX_PREMIUM_BPS, perActionCapE6: PER_ACTION_E6, dailyCapE6: DAILY_E6, largeActionE6: DAILY_E6 });
if (!mandate) throw new Error("no ailabs preset");
const fingerprint = mandateFingerprint(mandate);
let deskRow: DeskRow | null = null;
if (a.phases.has("D")) {
  await evidence.check("D1", "the AI Labs mandate (40/40/20) signed by the owner and stored as a LIVE desk", async () => {
    const problems = checkMandate(mandate);
    if (problems.length) throw new Error(problems.join("; "));
    const text = deskMandateText({ owner, cluster: "localnet", version: 1, fingerprint, signedAtIso: new Date().toISOString().slice(0, 19) + "Z" });
    const signature = signOwnerText(keys.secret(keys.ownerRole), text);
    if (!verifyOwnerText(owner, text, signature)) throw new Error("the owner's signature does not verify");
    const created = await q.createPracticeDesk({ owner, cluster: "localnet", mandateBody: mandateToWire(mandate) as unknown as Record<string, unknown>, fingerprint, signer: owner, signature, nowSec: nowSec() });
    await q.attachLiveDesk({ deskId: created.id, address: desk, operator, mode: "on_its_own", nowSec: nowSec() });
    deskRow = await q.getDeskById(created.id);
    if (!deskRow || deskRow.address !== desk || deskRow.mode !== "on_its_own") throw new Error("the desk row did not attach");
    evidence.fact("mandate", { fingerprint, targets: mandate.targets, signature, deskId: created.id });
    return { detail: `desk row ${created.id}, ${mandate.targets.tokens.map((t) => `${t.symbol} ${t.weightBps}`).join(" / ")} / cash ${mandate.targets.cashBps} bps, fingerprint ${fingerprint.slice(0, 18)}…, ed25519 signature verified` };
  });
}

// ---------------------------------------------------------------------------------------------- E one live wake
const stub = a.modelStub.toUpperCase() === "NONE" ? undefined : a.modelStub.toUpperCase();
const env = readDeskRunnerEnv({ ...process.env, DESK_CLUSTER: "localnet", DESK_RPC_URL: a.rpcUrl, DRY_RUN: "0", AGARI_KEYS_DIR: keys.dir, ...(stub ? { DESK_MODEL_STUB: stub } : {}) });
const feed = createPreStocksSpotFeed({ log });
feed.start();
const ctx: RunnerContext | null = await createRunnerContext({ log, prestocks: feed, env });
if (!ctx || !ctx.operator || !ctx.attestor) throw new Error("the runner context has no operator or attestor on the fork");
if (ctx.operator.address !== operator) throw new Error(`the runner signs as ${ctx.operator.address}, not the desk's operator`);
evidence.fact("runner", { cluster: env.cluster, rpcUrl: env.rpcUrl, dryRun: env.dryRun, modelStub: env.modelStub ?? null, brain: ctx.brain ? `${ctx.brain.providerName}/${ctx.brain.modelId}` : null });

if (a.phases.has("E")) {
  deskRow ??= await q.getDeskByOwner("localnet", owner);
  if (!deskRow) throw new Error("no desk row: run phase D");
  const symbols = mandateSymbols(mandate.targets);
  await evidence.check("E0", "the pools the wake will route through are re-fetched from mainnet (surfnet_resetAccount), so the fork fills at the price Jupiter quotes", async () => {
    const notes: string[] = [];
    for (const symbol of symbols) {
      const quote = await quoteSwap({ inputMint: USDC_MAINNET, outputMint: DESK_MINTS[symbol], amount: 400n * USDC, ...(process.env.JUPITER_API_KEY ? { apiKey: process.env.JUPITER_API_KEY } : {}) });
      const { deskUsdc, deskToken } = await deskTokenAccounts(desk, DESK_MINTS[symbol]);
      const route = await swapInstructions({ quote, desk, destinationTokenAccount: deskToken, payer: operator, ...(process.env.JUPITER_API_KEY ? { apiKey: process.env.JUPITER_API_KEY } : {}) });
      const reset = await refreshRoute(rpc, a.rpcUrl, route, [desk, deskUsdc, deskToken]);
      notes.push(`${symbol}: ${reset} of ${route.accountCount} route accounts reset`);
      await sleep(300);
    }
    return { detail: notes.join("; ") };
  });
  await evidence.check("E1", "the in-process PreStocks feed is warm (three reads in the half hour) for every mandate name", async () => {
    const started = nowSec();
    while (!feedWarm(feed, symbols, nowSec()) && nowSec() - started < a.maxWarmSec) await sleep(5_000);
    if (!feedWarm(feed, symbols, nowSec())) throw new Error(`not warm after ${a.maxWarmSec} s`);
    return { detail: symbols.map((s) => `${s} ${feed.history(s).length} reads, token ${formatUsdc(feed.history(s).at(-1)!.tokenPriceE8 / 100n)} mark ${formatUsdc(feed.history(s).at(-1)!.markPriceE8 / 100n)}`).join("; ") };
  });
  const before = (await readDeskState(rpc, owner, nowSec()))!;
  const wake = await q.claimWake({ deskId: deskRow.id, scheduledForSec: nowSec(), trigger: "test_read", nowSec: nowSec() });
  const report = await wakeDesk(ctx, { desk: deskRow, trigger: "test_read", scheduledForSec: nowSec(), wakeId: wake?.id ?? null });
  const after = (await readDeskState(rpc, owner, nowSec()))!;
  evidence.fact("wake", { status: report.status, note: report.note ?? null, records: report.records });
  await evidence.check("E2", `the live wake completed with a record per candidate (${stub ? `model stubbed ${stub}` : "real model"})`, async () => {
    if (report.status !== "completed") throw new Error(`${report.status}: ${report.note}`);
    return { detail: report.records.map((r) => `#${r.seq} ${r.outcome}: ${r.summary}`).join(" | ") };
  });
  const bought: { seq: number; symbol: string; signature: string; usdcIn: bigint; tokenOut: bigint; quoteOut: bigint; minOut: bigint; hash: string; head: string; chainSeq: bigint }[] = [];
  await evidence.check("E3", "operator_buy landed through the Jupiter CPI: Bought event, desk_actions confirmed, reference posted first", async () => {
    for (const r of report.records) {
      if (r.seq === null) continue;
      const stored = await q.getRecord({ deskId: deskRow!.id, seq: r.seq });
      for (const action of stored?.actions ?? []) {
        if (action.kind !== "buy" || action.state !== "confirmed" || !action.signature) continue;
        const events = await readDeskEventsOf(rpc, action.signature as never);
        const sealed = sealedActionsOf(events).find((s) => s.kind === "Bought");
        const event = events.find((e) => e.name === "Bought");
        if (!sealed || !event || event.name !== "Bought") throw new Error(`${action.signature} has no Bought event`);
        bought.push({ seq: r.seq, symbol: action.symbol ?? "?", signature: action.signature, usdcIn: event.data.usdcIn, tokenOut: event.data.tokenOut, quoteOut: BigInt(action.expectedOut ?? "0"), minOut: BigInt(action.minOut ?? "0"), hash: stored!.record.recordHash, head: sealed.head, chainSeq: sealed.seq });
      }
      const posts = (stored?.actions ?? []).filter((x) => x.kind === "post_ref" && x.state === "confirmed");
      if (posts.length && stored) evidence.fact(`postRef#${r.seq}`, posts.map((p) => p.signature));
    }
    // A candidate the wake meant to act on but could not send gets a NOT_EXECUTED record that says why; it is shown here.
    const notExecuted = (await q.listRecords({ deskId: deskRow!.id, limit: 20 })).filter((r) => r.outcome === "NOT_EXECUTED").map((r) => `#${r.seq} ${r.symbol ?? ""} ${r.summary}`);
    if (bought.length === 0) throw new Error(`no confirmed buy: ${report.records.map((r) => `${r.outcome} (${r.summary})`).join(" | ")}; ${notExecuted.join(" | ")}`);
    const overrides = await Promise.all(bought.map(async (b) => ((await q.getRecord({ deskId: deskRow!.id, seq: b.seq }))?.record.body as { override?: { by: string } | null }).override?.by ?? null));
    return { detail: `${bought.map((b, i) => `#${b.seq} ${b.symbol}: ${formatUsdc(b.usdcIn)} USDC → ${formatTokens(b.tokenOut)} raw (chain seq ${b.chainSeq}${overrides[i] ? `, override by ${overrides[i]}` : ""})`).join("; ")}${notExecuted.length ? `; not executed: ${notExecuted.join(" | ")}` : ""}`, signatures: bought.map((b) => b.signature) };
  });
  const needBuys = () => {
    if (bought.length === 0) throw new Error("nothing to check: E3 found no confirmed buy");
  };
  await evidence.check("E4", "USDC delta == Σ usdc_in; token delta ≥ min_out for every buy", async () => {
    needBuys();
    const spent = bought.reduce((s, b) => s + b.usdcIn, 0n);
    if (before.usdc.raw - after.usdc.raw !== spent) throw new Error(`usdc ${before.usdc.raw} → ${after.usdc.raw}, spent ${spent}`);
    const lines = bought.map((b) => {
      const mint = DESK_MINTS[b.symbol as keyof typeof DESK_MINTS] as string;
      const delta = (after.tokens.find((t) => t.mint === mint)?.raw ?? 0n) - (before.tokens.find((t) => t.mint === mint)?.raw ?? 0n);
      if (delta < b.minOut || delta !== b.tokenOut) throw new Error(`${b.symbol}: delta ${delta}, event ${b.tokenOut}, min_out ${b.minOut}`);
      return `${b.symbol} +${formatTokens(delta)} raw ≥ min_out ${formatTokens(b.minOut)}`;
    });
    return { detail: `USDC ${formatUsdc(before.usdc.raw)} → ${formatUsdc(after.usdc.raw)} (−${formatUsdc(spent)}); ${lines.join("; ")}` };
  });
  await evidence.check("E5", "gross vs net: Jupiter outAmount against the amount the desk's ATA received (the 100 bps transfer fee)", async () => {
    needBuys();
    const lines: string[] = [];
    for (const b of bought) {
      const mint = DESK_MINTS[b.symbol as keyof typeof DESK_MINTS];
      const { deskToken } = await deskTokenAccounts(desk, mint);
      const parsed = (await rpc.getAccountInfo(deskToken, { encoding: "jsonParsed" }).send()).value?.data as { parsed?: { info?: { extensions?: { extension: string; state: { withheldAmount?: string | number } }[] } } } | undefined;
      const withheld = BigInt(parsed?.parsed?.info?.extensions?.find((e) => e.extension === "transferFeeAmount")?.state.withheldAmount ?? 0);
      const netBps = bpsOf(b.tokenOut, b.quoteOut);
      const grossBps = bpsOf(b.tokenOut + withheld, b.quoteOut);
      const verdict = netBps <= 9_930 && grossBps >= 9_970 ? "the quote is GROSS: the fee comes off after the quote" : netBps >= 9_970 ? "the quote already NETS the fee" : "inconclusive (pool moved between quote and fill)";
      lines.push(`${b.symbol}: quote ${formatTokens(b.quoteOut)} → received ${formatTokens(b.tokenOut)} (${netBps} bps of quote), fee withheld on the ATA ${formatTokens(withheld)} (gross ${grossBps} bps of quote): ${verdict}`);
      evidence.fact(`grossNet:${b.symbol}`, { quoteOut: b.quoteOut, received: b.tokenOut, withheld, netBps, grossBps, verdict });
    }
    return { detail: lines.join(" | ") };
  });
  await evidence.check("E6", "record hash == Bought.decision_hash; chainHead(prev, seq, hash) == the on-chain head", async () => {
    needBuys();
    let prev = before.head;
    const lines: string[] = [];
    for (const b of [...bought].sort((x, y) => Number(x.chainSeq - y.chainSeq))) {
      const events = await readDeskEventsOf(rpc, b.signature as never);
      const sealed = sealedActionsOf(events).find((s) => s.kind === "Bought")!;
      if (sealed.decisionHash.toLowerCase() !== b.hash.toLowerCase()) throw new Error(`#${b.seq}: event hash ${sealed.decisionHash} ≠ record ${b.hash}`);
      const expected = chainHead(prev as never, sealed.seq, b.hash as never);
      if (expected.toLowerCase() !== sealed.head.toLowerCase()) throw new Error(`#${b.seq}: chainHead ${expected} ≠ sealed ${sealed.head}`);
      lines.push(`seq ${sealed.seq}: hash ${b.hash.slice(0, 12)}… head ${sealed.head.slice(0, 12)}…`);
      prev = sealed.head;
    }
    if (after.head.toLowerCase() !== prev.toLowerCase() || after.seq !== BigInt(bought.length)) throw new Error(`desk head ${after.head} seq ${after.seq}`);
    return { detail: `${lines.join("; ")}; desk seq ${after.seq}, head ${after.head.slice(0, 12)}…` };
  });
  chain = after;
}

// ---------------------------------------------------------------------------------------------- F prove-limits
if (a.phases.has("F")) {
  chain ??= await readDeskState(rpc, owner, nowSec());
  if (!chain) throw new Error("no desk on chain");
  const limits: Limits = { a, evidence, rpc, ctx, session, owner, operator, desk, chain, stranger: await keypairSigner(keys.secret("stranger")), log };
  await proveLimits(limits);
}

// ---------------------------------------------------------------------------------------------- G evidence
feed.stop();
const table = evidence.table();
const rows = evidence.rows;
console.log(`\n${table}\n\n${rows.filter((r) => r.ok).length}/${rows.length} checks passed; evidence ${evidence.path}; every send went to ${a.rpcUrl} (cluster tag ${CLUSTER_ID.localnet})`);
await db.end();
process.exit(rows.every((r) => r.ok) ? 0 : 1);
