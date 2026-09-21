#!/usr/bin/env -S pnpm exec tsx
// A-1c: the fade consent, and the rule that a wallet may hold only one direction per strategy.
//
// The page will not offer a follow while a fade is live, so this sends one anyway: the refusal has to come from the
// program, not from the control being disabled. Read-only apart from that one attempted write, which is expected to
// fail — nothing here opens a position.
//
// Run: pnpm exec tsx --env-file-if-exists=web/.env.local scripts/drive/strategy-fade.ts [--strategy 2] [--key drive-owner]

import { readFileSync } from "node:fs";
import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core";
import { configureMarkets, createSubmitterSession, getVaultSnapshot, parseMarketsEnv, syncClock } from "@agari/markets";
import { listSubscriptionsOf } from "@agari/markets/strategies";
import { arg } from "../deploy/ops-cluster";

const strategyId = BigInt(arg("--strategy", "2"));
const keyName = arg("--key", "drive-owner");
const secretKey = Uint8Array.from(JSON.parse(readFileSync(`${process.env.HOME}/.config/agari/devnet/${keyName}.json`, "utf8")));

const env = parseMarketsEnv({
  cluster: "devnet",
  rpcHttpUrls: process.env.RPC_URL ?? "https://api.devnet.solana.com",
  venueId: process.env.NEXT_PUBLIC_AGARI_VENUE_ID,
  vaultProgramId: process.env.NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID ?? "84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9",
});
configureMarkets(env);
await syncClock();

const session = await createSubmitterSession({ env, authority: "user-wallet", signer: { secretKey } });
const wallet = session.address as Address;
console.log(`wallet ${wallet}, strategy #${strategyId}`);

const consents = await listSubscriptionsOf(wallet, [strategyId]);
if (isOk(consents)) {
  for (const consent of consents.value) {
    console.log(`consent: ${consent.fade ? "FADE" : "follow"} · active ${consent.active} · live ${consent.live} · grant #${consent.grantId}`);
  }
  if (consents.value.length === 0) console.log("consent: none on record");
}

const snapshot = await getVaultSnapshot(wallet);
const grant = isOk(snapshot) && snapshot.value ? snapshot.value.grants.strategy : null;
console.log("strategy grant:", grant ? `#${grant.grantId} revoked=${grant.revoked}` : "none");
if (!grant) process.exit(1);

console.log("sending a follow while the fade stands — the program should refuse it");
const outcome = await session.submitter.submitTx({ kind: "strategy-subscribe", strategyId, grantId: grant.grantId, feeBase: 0n });
console.log("status:", outcome.status);
console.log("diagnosis:", JSON.stringify("diagnosis" in outcome ? outcome.diagnosis : null));
await session.dispose();
process.exit(outcome.status === "confirmed" ? 1 : 0);
