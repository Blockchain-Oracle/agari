/**
 * The checked-in rule table that keeps the architecture spine honest in CI, with no network.
 * Rule shapes:
 *  - pattern rules: { scopes, exts, exclude?, pattern } — every non-comment line matching `pattern` is a finding
 *  - file rules:    { file, mustMatch?, mustNotMatch?, optional? } — a single file's content is asserted
 *  - check rules:   { check(ctx) } — arbitrary logic returning findings
 *
 * Removed in S1 1b (D-015): the DreamDEX SDK rules (`sdk-import-boundary`, `sdk-version-pin`, `address-drift`,
 * `generated-abi`, `vault-abi-shape`) — the SDK, its pinned addresses and the Solidity ABIs are gone; `banned-wagmi-hooks`
 * — `no-evm` bans wagmi outright; and the EVM order-lane file rules (`order-lane-ioc`, `status-gate-enum`,
 * `expiry-from-headroom`) — their files were the EVM lane; S4 re-adds them against the Solana order lane.
 */
import { readText, walkFiles } from "./lib/walk.mjs";
import { finding } from "./lib/report.mjs";
import { idlNoDestination, kitImportBoundary, noEvm, programIdDrift } from "./lib/chain-rules.mjs";
import { pnpmOnly } from "./lib/pnpm-only.mjs";

const TS = [".ts", ".tsx"];
const OUTSIDE_MARKETS = ["web", "packages/core", "packages/db", "packages/brain", "services", "scripts"];
const MAX_FILE_LINES = 400;
/** Codama output is regenerated, never edited (`pnpm codegen && git diff --exit-code packages/clients`), so the cap skips it. */
const GENERATED = /^packages\/clients\/[^/]+\/src\/generated\//;

function fileLength(rule, ctx) {
  const findings = [];
  for (const scope of rule.scopes) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, rule.exts)) {
      if (GENERATED.test(rel)) continue;
      const lines = readText(abs).split("\n").length;
      if (lines > MAX_FILE_LINES) findings.push(finding(rule, `${lines} lines (max ${MAX_FILE_LINES})`, rel));
    }
  }
  return findings;
}

export const rules = [
  { id: "no-evm", description: "no EVM library in any workspace source or manifest (shrinking allowlist, empty at the S1 gate)", check: noEvm },
  { id: "kit-import-boundary", description: "only packages/markets imports the Solana/oracle SDKs; web3.js 1 only under prices/legacy (plan §6)", check: kitImportBoundary },
  { id: "idl-no-destination", description: "no program instruction takes a caller-chosen payout destination (AD-5)", check: idlNoDestination },
  { id: "program-id-drift", description: "declare_id! == Anchor.toml == scripts/deploy/addresses.devnet.json", check: programIdDrift },
  {
    id: "write-boundary",
    description: "no transaction sends outside packages/markets (AD-3); the wallet island only wraps the wallet's own send for markets",
    scopes: OUTSIDE_MARKETS,
    exts: TS,
    exclude: ["web/src/providers"],
    pattern: /\b(writeContract|sendTransaction|sendRawTransaction|sendAndConfirmTransaction|signAndSendTransaction)\s*\(/,
  },
  {
    id: "design-literals",
    description: "no raw hex colors or px literals in component code — use theme.css / tokens.css (AD-12)",
    scopes: ["web/src/app", "web/src/components", "web/src/features", "web/src/providers"],
    exts: TS,
    pattern: /(#[0-9a-fA-F]{3,8}\b|\b\d+(\.\d+)?px\b)/,
  },
  {
    id: "time-suffix",
    description: "time-shaped fields carry their unit suffix (Ms | Sec | Ns)",
    scopes: ["packages/core", "packages/markets", "services"],
    exts: TS,
    pattern: /\b(expiry|expires|expireTimestamp|timestamp|createdAt|updatedAt|settledAt|resolvedAt|tradingStart|quotedAt|asOf|deadline|lastTick)\s*\??:/,
  },
  {
    id: "no-float-money",
    description: "money and probabilities are integers; float parsing of amounts is a defect (AD-2)",
    severity: "warn",
    scopes: ["packages/core", "packages/markets"],
    exts: TS,
    pattern: /\b(parseFloat|Number)\(\s*\w*(amount|cost|stake|payout|balance|price)\w*/i,
  },
  {
    id: "file-length",
    description: `no source file over ${MAX_FILE_LINES} lines`,
    scopes: ["web/src", "packages", "services", "scripts", "anchor"],
    exts: [...TS, ".mjs", ".css", ".rs"],
    check: fileLength,
  },
  { id: "pnpm-only", description: "pnpm is the only package manager (root pin, no foreign lockfiles, Anchor uses pnpm)", check: pnpmOnly },
];
