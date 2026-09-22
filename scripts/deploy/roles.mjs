#!/usr/bin/env node
// Ensures one keypair per operator role in ~/.config/agari/devnet/<role>.json (or `AGARI_KEYS_DIR`, so mainnet keys never
// share a file with devnet: `AGARI_KEYS_DIR=~/.config/agari/mainnet pnpm roles`) and prints public keys.
// Ensure-style: existing keypairs are never regenerated or overwritten. Secret keys are never printed.
// Run: pnpm roles            (add --json for machine-readable output)
// Keypair files use the Solana CLI format: a JSON array of 64 bytes (32-byte seed + 32-byte public key).

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Role → what signs with it (plan §4, §7.1 env checklist). */
export const ROLES = {
  deployer: "program deploys and upgrade authority (devnet)",
  admin: "agari-events GlobalConfig admin, series and policy versions",
  roller: "window-roller: opens Windows",
  "price-relay": "price-relay: posts Pyth/RedStone/Switchboard prints",
  "price-attestor": "price-relay: ed25519 attested prints (opt-in only)",
  settler: "settler: settle, void, redeem_for, close",
  maker: "market-maker actor",
  sponsor: "web api/sponsor fee payer",
  "faucet-mint-authority": "tUSDC mint authority (signs mintToChecked only)",
  "proof-replay": "S5 proof replay: posts archived Pyth blobs to the devnet receiver (never price-relay, whose sweep closes its accounts)",
  "sol-faucet": "web api/faucet: devnet SOL top-ups, fee payer for faucet claims and ATA rent (S4, D-034)",
  "tusdc-mint": "tUSDC mint address (signs once, when init-events creates the mint)",
  runner: "strategy-runner",
  "leverage-keeper": "leverage-keeper",
  "x-executor": "x-relay executor",
  "private-desk": "private desk key",
  "game-deck": "arena deckmaster",
  "game-settler": "duel-settler",
  "season-admin": "season prize pool admin",
  "drive-bidder": "drive-only: rests the bid on a Window the drive owns (Series 903)",
  "drive-asker": "drive-only: rests the ask on a Window the drive owns (Series 903)",
  "drive-owner": "drive-only: the wallet that opens positions in a product drive, distinct from the provider",
  "drive-rival": "drive-only: the second player of a duel drive",
  "drive-key": "drive-only: a duel seat's browser key, the one that places picks without a wallet prompt",
  "desk-runner": "desk-runner: the desk's operator on mainnet (S21, D-126); never the same file as a devnet key",
};

const DIR = process.env.AGARI_KEYS_DIR || join(homedir(), ".config", "agari", "devnet");
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

function newKeypairBytes() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });
  const seed = Buffer.from(jwk.d, "base64url");
  const pub = Buffer.from(jwk.x, "base64url");
  return [...seed, ...pub];
}

export function ensureRole(role) {
  const path = join(DIR, `${role}.json`);
  let created = false;
  if (!existsSync(path)) {
    mkdirSync(DIR, { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(newKeypairBytes()), { mode: 0o600, flag: "wx" });
    created = true;
  }
  const bytes = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(bytes) || bytes.length !== 64) throw new Error(`${path} is not a 64-byte Solana keypair`);
  return { role, pubkey: base58(bytes.slice(32)), path, created };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = Object.entries(ROLES).map(([role, use]) => ({ ...ensureRole(role), use }));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(Object.fromEntries(rows.map((r) => [r.role, r.pubkey])), null, 2));
  } else {
    console.log(`Role keypairs in ${DIR} (secrets never printed):`);
    console.table(rows.map(({ role, pubkey, created, use }) => ({ role, pubkey, new: created ? "yes" : "", use })));
  }
}
