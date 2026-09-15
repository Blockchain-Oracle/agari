#!/usr/bin/env -S pnpm exec tsx
// S7 vault drive (tap-trading.md §6, lane 7b): agari-vault through the real adapter lanes on a Surfpool devnet fork.
//   localnet — any hour: the vault program is deployed into the fork beforehand (never devnet), then this run inits and
//     registers it, opens a drive-only TEST-ATT-5m Window, and proves: one-signature enable, three session-key taps
//     with the sponsor as fee payer, a cap refusal with no send and no co-sign request, a vault cash-out, a wallet plain
//     cash-out, a killed co-signed tap reconciled by signature, revoke, a third-party crank, the Ledger closing, withdraw.
// Before:  solana program deploy --url <fork> --keypair ~/.config/agari/devnet/deployer.json
//            --upgrade-authority ~/.config/agari/devnet/deployer.json --program-id ~/.config/agari/programs/agari-vault.json agari_vault.so
//          and fork SOL for the deployer and sponsor roles (solana airdrop).
// Run:  pnpm exec tsx scripts/drive/vault.ts [--rpc URL] [--ws URL] [--scratch DIR] [--fixtures DIR]
// Keys: ~/.config/agari/devnet/<role>.json (deployer pays; roller, faucet-mint-authority, price-attestor, settler, sponsor sign).

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDrive } from "./first-call-kit";
import { saveVaultEvidence } from "./vault-kit";
import { killedTapChild, vaultForkDrive } from "./vault-fork";

const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
const rpcUrl = arg("--rpc", "http://127.0.0.1:9071");
const wsUrl = arg("--ws", "ws://127.0.0.1:9072");
const scratch = process.argv.includes("--scratch") ? arg("--scratch", "") : mkdtempSync(join(tmpdir(), "agari-vault-drive-"));
const fixtures = arg("--fixtures", scratch);

if (process.argv.includes("--child")) {
  await killedTapChild(arg("--state", ""));
} else {
  const d = await openDrive({ cluster: "localnet", rpcUrl, wsUrl, scratch });
  console.log(`vault drive on ${rpcUrl}, config ${d.config}, mint ${d.mint}`);
  const results = await vaultForkDrive(d, fixtures);
  saveVaultEvidence(d, join(scratch, "last-run.vault-localnet.json"), results);
  writeFileSync(join(scratch, "vault-drive.done"), "ok\n");
  process.exit(0);
}
