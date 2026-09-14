#!/usr/bin/env node
// Prints which environment variables are present for root scripts, web and ops. Never prints values.
// Run: pnpm env:check
// Reads .env.local files (root, web, services/ops) plus the process environment. Always exits 0:
// a missing variable is only a problem once its stage starts.

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const FILES = { root: ".env.local", web: "web/.env.local", ops: "services/ops/.env.local" };

/** [name, needed-from stage, optional?] */
const GROUPS = {
  root: [
    ["PYTH_API_KEY", "S0"], ["ALPACA_ENDPOINT", "S0"], ["ALPACA_KEY_ID", "S0"], ["ALPACA_SECRET_KEY", "S0"],
    ["FINNHUB_API_KEY", "S0"], ["HELIUS_API_KEY", "S0"], ["JUPITER_API_KEY", "S6", true], ["STORK_API_KEY", "—", true],
  ],
  web: [
    ["DATABASE_URL", "S1"],
    ["NEXT_PUBLIC_SOLANA_RPC_URL", "S4"], ["NEXT_PUBLIC_SOLANA_WS_URL", "S4"], ["HELIUS_API_KEY", "S4"],
    ["SPONSOR_PRIVATE_KEY", "S4"], ["FAUCET_MINT_AUTHORITY_PRIVATE_KEY", "S4"], ["FINNHUB_API_KEY", "S13"],
    ["OPENAI_API_KEY", "S13"], ["AI_MODEL", "S13"], ["X_SESSION_SECRET", "S11"], ["X_REDIRECT_URI", "S11"],
    ["X_API_KEY", "S11"], ["X_API_KEY_SECRET", "S11"], ["ROOM_TOKEN_SECRET", "S12b"],
  ],
  ops: [
    ["DATABASE_URL", "S3"], ["HELIUS_API_KEY", "S3"], ["PYTH_API_KEY", "S3"], ["ALPACA_KEY_ID", "S3"],
    ["ALPACA_SECRET_KEY", "S3"], ["ROLLER_PRIVATE_KEY", "S3"], ["PRICE_RELAY_PRIVATE_KEY", "S3"],
    ["PRICE_ATTESTOR_PRIVATE_KEY", "S3"], ["SETTLER_PRIVATE_KEY", "S3"], ["MAKER_PRIVATE_KEY", "S3"],
    ["REDSTONE_GATEWAY_URLS", "S3", true], ["SWITCHBOARD_CROSSBAR_URL", "S6", true], ["RUNNER_PRIVATE_KEY", "S9"],
    ["OPENAI_API_KEY", "S9"], ["AI_MODEL", "S9"], ["LEVERAGE_KEEPER_PRIVATE_KEY", "S10c"],
    ["PRIVATE_DESK_PRIVATE_KEY", "S10d"], ["X_HANDLE", "S11"], ["X_RETTIWT_API_KEY", "S11"],
    ["X_EXECUTOR_PRIVATE_KEY", "S11"], ["GAME_DECK_KEY", "S12b"], ["ROOM_TOKEN_SECRET", "S12b"],
    ["GAME_DECK_PRIVATE_KEY", "S12b"], ["GAME_SETTLER_PRIVATE_KEY", "S12b"], ["SEASON_ADMIN_PRIVATE_KEY", "S12b"],
  ],
};

const load = (path) => (existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : null);

let missingNow = 0;
for (const [group, vars] of Object.entries(GROUPS)) {
  const file = load(FILES[group]);
  console.log(`\n${group} (${FILES[group]}${file ? "" : " — file missing"})`);
  const rows = vars.map(([name, stage, optional]) => {
    const present = Boolean((file?.[name] ?? process.env[name] ?? "").trim());
    if (!present && !optional && stage === "S0") missingNow++;
    return { name, stage, status: present ? "✅ set" : optional ? "· optional" : "☐ missing" };
  });
  console.table(rows);
}
console.log(missingNow ? `\n${missingNow} variable(s) needed for S0 are missing.` : "\nAll variables needed for S0 are set.");
