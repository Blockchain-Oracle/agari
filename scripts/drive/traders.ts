#!/usr/bin/env -S pnpm exec tsx
// traders drive (S5, Q-S5-3): three test keypairs take IOC calls through the real order lane (S4 4b) against the soak's
// seed maker on the live TSLA-5m and NVDA-5m Windows, one call per wallet per Window, so the board, `/stats` and the
// recount have real signed fills to count. Wallets are topped up from the S4 faucet chain (`sol-faucet` SOL,
// `faucet-mint-authority` tUSDC). The settler pays winners after its grace (D-032), so no claim is sent.
// NYSE hours only (13:30–20:00Z on session days): the drive asks ops `/session` and refuses otherwise.
// Run:  pnpm drive:traders --keys <dir outside the repo> [--rounds 12] [--rpc URL|helius] [--ws URL] [--ops http://localhost:8787]
// Keys: <dir>/trader-{1,2,3}.json (created once, never committed); journals and evidence.json land beside them.
// --check: any hour, sends nothing: connects, loads the keys, reads their balances and each lane's current Window.

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { keypairAddress, readMarket, readSeries } from "@agari/markets";
import { keypairSigner, windowAddresses } from "@agari/markets/deploy";
import { createFaucetChain, faucetRoleSecret } from "@agari/markets/faucet";
import type { EventMarket, Side } from "@agari/core";
import { openDrive, phases, quoteNow, sleep, userSession, type Drive, type User } from "./first-call-kit";

const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
const keysDir = arg("--keys", "");
if (!keysDir || keysDir.startsWith(process.cwd())) throw new Error("--keys must name a directory outside the repo (test keypairs are never committed)");
const rounds = Number(arg("--rounds", "12"));
const helius = process.env.HELIUS_API_KEY;
const rpcArg = arg("--rpc", "https://api.devnet.solana.com");
// `--rpc helius` reads the key from env, so it never sits on a command line; websockets stay on public devnet (D-030).
const rpcUrl = rpcArg === "helius" ? `https://devnet.helius-rpc.com/?api-key=${helius ?? ""}` : rpcArg;
const redact = (text: string) => (helius ? text.replaceAll(helius, "<HELIUS_API_KEY>") : text);
const wsUrl = arg("--ws", "wss://api.devnet.solana.com");
const ops = arg("--ops", "http://localhost:8787");
const checkOnly = process.argv.includes("--check");

const TICKERS = [
  { symbol: "TSLA", lane: "TSLA-5m", printSource: "pyth" },
  { symbol: "NVDA", lane: "NVDA-5m", printSource: "redstone" },
] as const;
const WALLETS = 3;
/** 0.01 SOL each: ≈ 25 orders at 5,000 lamports a signature with room to spare. */
const TOPUP_LAMPORTS = 10_000_000n;
const MIN_LAMPORTS = 4_000_000n;
const TUSDC_BASE = 100_000_000n;
const MIN_TUSDC_BASE = 20_000_000n;
/** Stakes differ per wallet so the board has an order to show: 1, 2 and 3 tUSDC. */
const STAKES = [1_000_000n, 2_000_000n, 3_000_000n];
/** An order needs this much time before the Window locks (the lane's own expiry headroom is lock-aware). */
const LOCK_HEADROOM_SEC = 60;
const CADENCE_SEC = 300;

type Evidence = { atIso: string; wallet: string; ticker: string; market: string; side: Side; stakeBase: string; status: string; signature: string | null; detail?: string };

function loadOrCreateKey(index: number): Uint8Array {
  const path = join(keysDir, `trader-${index}.json`);
  if (!existsSync(path)) {
    const { privateKey } = generateKeyPairSync("ed25519");
    const jwk = privateKey.export({ format: "jwk" });
    const secret = [...Buffer.from(jwk.d!, "base64url"), ...Buffer.from(jwk.x!, "base64url")];
    writeFileSync(path, JSON.stringify(secret), { mode: 0o600 });
  }
  return Uint8Array.from(JSON.parse(readFileSync(path, "utf8")) as number[]);
}

async function inSession(): Promise<string> {
  const body = (await (await fetch(`${ops}/session`)).json()) as { status: { state: string } | null; label: string };
  if (body.status?.state !== "regular" && body.status?.state !== "early-close") throw new Error(`NYSE is not in session (${body.status?.state ?? "unknown"}: ${body.label}); run the traders drive during 13:30–20:00Z`);
  return body.label;
}

/** Tops a wallet up from the faucet chain when it runs low, and waits for the balance to show. */
async function fund(faucet: ReturnType<typeof createFaucetChain>, wallet: string, log: (line: string) => void) {
  if ((await faucet.balance(wallet)) < MIN_LAMPORTS) {
    const sol = await faucet.prepare(wallet, TOPUP_LAMPORTS);
    await faucet.broadcast({ rawTransaction: sol.rawTransaction, txHash: sol.txHash } as never);
    log(`  ${wallet} SOL top-up ${TOPUP_LAMPORTS} lamports: ${sol.txHash}`);
    for (let i = 0; i < 30 && (await faucet.balance(wallet)) < MIN_LAMPORTS; i++) await sleep(2_000);
  }
  if (((await faucet.tokenBalance(wallet)) ?? 0n) < MIN_TUSDC_BASE) {
    const mint = await faucet.prepareMint(wallet, TUSDC_BASE);
    await faucet.broadcast({ rawTransaction: mint.rawTransaction, txHash: mint.txHash } as never);
    log(`  ${wallet} tUSDC mint ${TUSDC_BASE} base: ${mint.txHash}`);
    for (let i = 0; i < 30 && ((await faucet.tokenBalance(wallet)) ?? 0n) < MIN_TUSDC_BASE; i++) await sleep(2_000);
  }
}

/** The lane's Window that is trading now with lock headroom, as the ticket would see it; null between Windows. */
async function liveWindow(d: Drive, ticker: (typeof TICKERS)[number]): Promise<EventMarket | null> {
  const series = d.venue.series![ticker.lane]!;
  const onchain = await d.client.agariEvents.accounts.series.fetch(series.address as never);
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  for (const back of [1n, 2n]) {
    if (onchain.data.nextIndex < back) continue;
    const w = await windowAddresses(series.address as never, onchain.data.nextIndex - back);
    const account = await readMarket(w.market);
    if (!account || account.data.state !== 0) continue;
    const tradingStartSec = Number(account.data.tradingStart);
    const lockAtSec = Number(account.data.lockAt);
    if (nowSec < tradingStartSec || nowSec > lockAtSec - LOCK_HEADROOM_SEC) continue;
    const facts = await readSeries(series.address as never);
    return {
      marketId: w.market, venueId: d.config, asset: ticker.symbol, lane: "regular", question: "", intervalSec: facts.cadenceSec,
      tradingStartSec, lockAtSec, expirySec: Number(account.data.expiry), poolAddress: account.data.book, marketAddress: w.market,
      seriesAddress: series.address, nonce: w.index, policyVersion: account.data.policyVersion, printSource: ticker.printSource, collateral: d.mint,
      decimals: 6, status: "Trading", winningOutcome: null, voided: false, voidReason: null, finalized: false, openingPriceRaw: null,
      volumeQuoteRaw: 0n, tradeCount: 0, lastPriceRaw: null, resolvedAtMs: null,
    } as never;
  }
  return null;
}

mkdirSync(keysDir, { recursive: true });
const label = checkOnly ? "check only" : await inSession();
const d = await openDrive({ cluster: "devnet", rpcUrl, wsUrl, scratch: keysDir });
console.log(`traders drive on devnet via ${redact(rpcUrl)} (${label}): ${rounds} rounds × ${TICKERS.map((t) => t.lane).join(", ")} × ${WALLETS} wallets`);
const funder = faucetRoleSecret("sol-faucet", process.env);
if (!funder) throw new Error("sol-faucet key not found (SOL_FAUCET_PRIVATE_KEY or ~/.config/agari/devnet/sol-faucet.json)");
const faucet = createFaucetChain({ funder, mintAuthority: faucetRoleSecret("faucet-mint-authority", process.env) }, rpcUrl);

const traders: { user: User; session: Awaited<ReturnType<typeof userSession>> }[] = [];
for (let i = 1; i <= WALLETS; i++) {
  const secret = loadOrCreateKey(i);
  const user: User = { label: `trader-${i}`, secret, address: keypairAddress(secret), signer: await keypairSigner(secret), token: "" };
  if (checkOnly) {
    console.log(`  trader-${i} ${user.address}: ${await faucet.balance(user.address)} lamports, ${(await faucet.tokenBalance(user.address)) ?? "no"} tUSDC base`);
    continue;
  }
  await fund(faucet, user.address, (line) => console.log(line));
  traders.push({ user, session: await userSession(d, user, join(keysDir, `trader-${i}-journal.json`)) });
  console.log(`  trader-${i} ${user.address} ready`);
}

if (checkOnly) {
  for (const ticker of TICKERS) console.log(`  ${ticker.lane}: ${(await liveWindow(d, ticker))?.marketId ?? "no Window with lock headroom"}`);
  process.exit(0);
}

const evidence: Evidence[] = [];
const save = () => writeFileSync(join(keysDir, "evidence.json"), `${JSON.stringify({ wallets: traders.map((t) => t.user.address), orders: evidence }, null, 2)}\n`);
for (let round = 0; round < rounds; round++) {
  await inSession();
  await d.clock.sync();
  for (const [t, ticker] of TICKERS.entries()) {
    const market = await liveWindow(d, ticker);
    if (!market) {
      console.log(`round ${round + 1} ${ticker.lane}: no Window with lock headroom`);
      continue;
    }
    for (const [i, { user, session }] of traders.entries()) {
      const side: Side = (round + i + t) % 2 === 0 ? "up" : "down";
      const stakeBase = STAKES[i]!;
      const row: Evidence = { atIso: new Date().toISOString(), wallet: user.address, ticker: ticker.symbol, market: market.marketId, side, stakeBase: String(stakeBase), status: "", signature: null };
      try {
        const quote = await quoteNow(d, market, side, stakeBase);
        const outcome = await session.submitter.submitOrder({ market, side, stakeBase, displayedQuote: quote, wallet: user.address as never }, phases(`${user.label} ${side}`));
        row.status = outcome.status;
        row.signature = outcome.status === "confirmed" ? outcome.booked.txHash : "txHash" in outcome ? (outcome.txHash ?? null) : null;
        if ("diagnosis" in outcome) row.detail = outcome.diagnosis.technical;
      } catch (error) {
        row.status = "error";
        row.detail = redact(error instanceof Error ? error.message : String(error));
      }
      evidence.push(row);
      console.log(`round ${round + 1} ${ticker.lane} #${market.nonce} ${user.label} ${side} ${stakeBase}: ${row.status} ${row.signature ?? row.detail ?? ""}`);
      save();
    }
  }
  if (round + 1 < rounds) {
    const nowSec = Math.floor(d.clock.nowMs() / 1000);
    // The next Window opens around its boundary and the maker quotes it within seconds.
    await sleep(((Math.floor(nowSec / CADENCE_SEC) + 1) * CADENCE_SEC + 30 - nowSec) * 1000);
  }
}
const confirmed = evidence.filter((e) => e.status === "confirmed").length;
console.log(`traders drive done: ${confirmed}/${evidence.length} orders confirmed; evidence → ${join(keysDir, "evidence.json")}`);
process.exit(0);
