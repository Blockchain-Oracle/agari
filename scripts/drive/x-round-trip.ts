#!/usr/bin/env -S pnpm exec tsx
// S11 drive (L-58, L-60, A-3d): the trade-from-X round trip on devnet, end to end, with no browser.
//   lanes                                            the Windows a mention could name right now
//   status  --wallet <addr>                          the Trading Balance and its X grant, exactly as the relay reads them
//   arm     --as <role> [--amount 5]                 mint tUSDC to the role, then deposit-and-grant an EXECUTOR grant to
//                                                    X_EXECUTOR_ADDRESS through the app's own submitter lane
//   link    --as <role> --author <id> [--handle <h>] bind that X account to the wallet. Sign in with X writes this row from
//                                                    OAuth; without X_API_KEY/X_API_KEY_SECRET the drive writes it directly.
//                                                    The relay only ever READS it, so the rest of the lane is unchanged.
//   post    --text "@handle OPENAI UP 2 1h"          post the mention from the relay account — a PUBLIC post, asks first
//   receipt --mention <id>                           the receipt the relay wrote for that mention
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/x-round-trip.ts <mode> [...]
// The chain work is the app's: `createSubmitterSession` + `vault-deposit-and-grant`, the same intent `/trade-from-x` sends.

import {
  configureMarkets, createSubmitterSession, getCollateral, getVaultSnapshot, loadCollateral, marketsEnvInputFrom, marketsProvider,
  parseMarketsEnv, resolveVenueId, syncClock,
} from "@agari/markets";
import { createDeployClient, fundUser, keypairSigner } from "@agari/markets/deploy";
import { isBalanceOnlyXGrant, parseInstruction, selectXWindow, xGrantCaps, X_GRANT, X_MONETARY_CEILING } from "@agari/core/x";
import { xLinkUpsert, xReceiptByMention } from "@agari/db";
import type { Address } from "@agari/core/types";
import { clusterArg, endpoints, roleSecret, rolePubkey } from "../deploy/ops-cluster";
import { fileJournal } from "./first-call-kit";

const mode = process.argv[2] ?? "lanes";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const show = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);
const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const executor = (process.env.X_EXECUTOR_ADDRESS ?? "") as Address;

// Read the process environment the way an ops actor does (`opsMarketsEnv`), or the indexer URL and the program ids
// in .env.local are silently dropped and every lane read answers "no indexer configured".
const marketsEnv = parseMarketsEnv({ ...marketsEnvInputFrom(process.env), cluster, rpcHttpUrls: rpcUrl, rpcWsUrls: rpcSubscriptionsUrl });
configureMarkets(marketsEnv);
await syncClock();
await loadCollateral();
console.log(`x round-trip drive "${mode}" on ${cluster} (${label}); executor ${executor || "<X_EXECUTOR_ADDRESS unset>"}`);

const venue = await resolveVenueId(null);
if (!venue.ok) throw new Error(`venue unresolved: ${show(venue)}`);
if (!venue.value.venueId) throw new Error("this deployment has no venue id");
const venueId = venue.value.venueId;

/** Every Window a mention could name, with the cadence word the grammar accepts for it. */
async function lanes() {
  const reading = await marketsProvider.listLiveLanes(venueId);
  if (!reading.ok) throw new Error(`live lanes unavailable: ${show(reading)}`);
  const markets = reading.value.lanes.flatMap((l) => l.markets);
  const nowMs = marketsProvider.nowMs();
  console.log(`${markets.length} live Windows on ${venueId} (stale=${reading.stale})`);
  for (const m of [...markets].sort((a, b) => a.expirySec - b.expirySec)) {
    const closes = new Date(m.expirySec * 1000).toISOString().slice(11, 19);
    const open = m.openingPriceRaw === null ? "open print pending" : "printed";
    console.log(`  ${m.asset.padEnd(9)} ${String(m.intervalSec).padStart(5)}s ${m.lane.padEnd(8)} closes ${closes}Z  ${open}`);
  }
  const probe = parseInstruction(arg("--text") ?? "OPENAI UP 2 1h", { decimals: getCollateral().decimals });
  if (!probe.ok) return console.log(`\nthat instruction does not parse: ${show(probe)}`);
  const picked = selectXWindow(markets, probe.instruction, nowMs);
  console.log(`\n"${arg("--text") ?? "OPENAI UP 2 1h"}" selects: ${picked.ok ? `${picked.market.asset} ${picked.market.intervalSec}s on the ${picked.market.lane} lane, ${picked.market.marketId}` : show(picked)}`);
}

async function status(wallet: Address) {
  const snap = await getVaultSnapshot(wallet);
  if (!snap.ok || !snap.value) return console.log(`no Trading Balance for ${wallet}: ${show(snap)}`);
  const g = snap.value.grants.executor;
  console.log(`wallet    ${wallet}`);
  console.log(`available ${snap.value.account.availableBase}`);
  console.log(`grant     ${g ? show({ grantId: g.grantId, actor: g.actor, budgetBase: g.budgetBase, expiresAtSec: g.expiresAtSec, revoked: g.revoked }) : "none"}`);
  if (g && executor) console.log(`names the executor? ${g.actor === executor ? "yes" : `NO — grant names ${g.actor}`}`);
  if (g) {
    console.log(`caps      ${show(g.caps)}`);
    console.log(`ceiling   ${X_MONETARY_CEILING}`);
    console.log(`the relay would accept this grant? ${isBalanceOnlyXGrant(g) ? "yes" : "NO — isBalanceOnlyXGrant is false"}`);
  }
}

async function arm(role: string, amountBase: bigint) {
  if (!executor) throw new Error("X_EXECUTOR_ADDRESS is not set");
  const wallet = rolePubkey(role) as Address;
  const { address: mint, decimals } = getCollateral();
  const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
  await fundUser({ client, log: (e) => console.log(`  ${e.step}: ${e.note}`) },
    // The deploy lane speaks @solana/kit's branded Address; core brands its own. Same base58, different brand, and
    // a script may not import the chain SDKs to convert (plan §6) — so `as never`, the convention the other drives use.
    { faucet: await keypairSigner(roleSecret("faucet-mint-authority")), mint: mint as never, owner: wallet as never, amount: amountBase });
  const session = await createSubmitterSession({
    env: marketsEnv,
    authority: "user-wallet", signer: { secretKey: roleSecret(role) },
    journal: fileJournal(`data/drive/x-${role}.journal.json`, () => Date.now()), nowMs: () => Date.now(),
  });
  const terms = { kind: "executor" as const, actor: executor, caps: xGrantCaps(), budgetBase: amountBase,
    expiresAtSec: Math.floor(Date.now() / 1000) + X_GRANT.days * 86_400 };
  const outcome = await session.submitter.submitTx({ kind: "vault-deposit-and-grant", amountBase, terms });
  console.log(`deposit-and-grant ${amountBase} base units (${decimals} dp) → ${show(outcome)}`);
  await status(wallet);
}

async function link(role: string, authorId: string, handle: string | undefined) {
  const wallet = rolePubkey(role);
  // Sign in with X writes this row from an OAuth callback and stores that flow's signature. The drive marks its own
  // rows `drive:` so a link that never saw OAuth is never mistaken for one that did.
  const row = await xLinkUpsert({ authorId, handle: handle ?? null, wallet, signature: `drive:${Date.now()}`, issuedAtMs: Date.now() });
  console.log(`link ${authorId}${handle ? ` (@${handle})` : ""} → ${wallet}\n${show(row)}`);
}

switch (mode) {
  case "lanes": await lanes(); break;
  case "status": await status((arg("--wallet") ?? rolePubkey(arg("--as") ?? "drive-bidder")) as Address); break;
  case "arm": await arm(arg("--as") ?? "drive-bidder", BigInt(Math.round(Number(arg("--amount") ?? "5") * 1e6))); break;
  case "link": await link(arg("--as") ?? "drive-bidder", arg("--author") ?? "", arg("--handle")); break;
  case "receipt": console.log(show(await xReceiptByMention(arg("--mention") ?? ""))); break;
  default: throw new Error(`unknown mode "${mode}"`);
}
process.exit(0);
