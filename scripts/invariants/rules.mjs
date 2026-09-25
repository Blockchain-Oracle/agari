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
 *
 * A check rule returns its findings, or `{ findings, skipped }` when part of what it guards has not landed yet.
 */
import { codeLines, readText, walkFiles } from "./lib/walk.mjs";
import { finding } from "./lib/report.mjs";
import { idlNoDestination, kitImportBoundary, noEvm, programIdDrift } from "./lib/chain-rules.mjs";
import { pnpmOnly } from "./lib/pnpm-only.mjs";
import { venueIdentity } from "./lib/venue-identity.mjs";

const TS = [".ts", ".tsx"];
const OUTSIDE_MARKETS = ["web", "mobile", "packages/core", "packages/db", "packages/brain", "services", "scripts"];
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

/** tap-trading.md §2 (D-066): the session key's secret never exists as bytes in the page. */
const EXTRACTABLE_KEY = /\bexportKey\s*\(|\bextractable\s*:\s*true\b|\bgenerateKeyPair(?:Signer)?\s*\(\s*true\b/;
/** The S1 port's PKCS#8 export, which lane 7c replaces with `generateSessionKey` from `@agari/markets` and the v2 store. */
const S1_KEYGEN = "web/src/features/session/keygen.ts";

function sessionKeyNonExtractable(rule, ctx) {
  const findings = [];
  for (const scope of rule.scopes) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, TS)) {
      for (const [lineNo, line] of codeLines(readText(abs))) {
        const match = EXTRACTABLE_KEY.exec(line);
        if (match) findings.push(finding(rule, `\`${match[0]}\``, `${rel}:${lineNo}`));
      }
    }
  }
  // Optional while the S1 keygen still exports its key: that file alone is waived, every other file is held to the rule.
  const pending = findings.filter((f) => f.location.startsWith(`${S1_KEYGEN}:`));
  if (!rule.optional || pending.length === 0) return findings;
  const rest = findings.filter((f) => !pending.includes(f));
  return rest.length > 0 ? rest : { findings: [], skipped: `${S1_KEYGEN} still exports its key until lane 7c's v2 store` };
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
    id: "mobile-design-literals",
    description: "no raw colours in the app's component code — every colour is a mobile/src/theme token (AD-12, D-128)",
    scopes: ["mobile/src"],
    exts: TS,
    exclude: ["mobile/src/theme", "mobile/src/components/ui/SvgStop.tsx"],
    pattern: /(#[0-9a-fA-F]{3,8}\b|\brgba?\()/,
  },
  {
    id: "mobile-svg-stop",
    description: "a gradient stop is painted with {...stopPaint(colour)} from ~/components/ui/SvgStop — react-native-svg swaps an rgba() alpha for stopOpacity and paints the wash solid (S26)",
    scopes: ["mobile/src"],
    exts: TS,
    exclude: ["mobile/src/components/ui/SvgStop.tsx"],
    pattern: /(import[^;]*\bStop\b[^;]*from "react-native-svg"|\bstopColor=)/,
  },
  {
    id: "mobile-no-web-handoff",
    description: "the app never hands a product route to a browser or web view; only mobile/src/lib/external.ts opens outside links (S26)",
    scopes: ["mobile/src"],
    exts: TS,
    exclude: ["mobile/src/lib/external.ts"],
    pattern: /(expo-web-browser|openBrowserAsync|react-native-webview|<WebView\b)/,
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
    scopes: ["web/src", "mobile/src", "packages", "services", "scripts", "anchor"],
    exts: [...TS, ".mjs", ".css", ".rs"],
    check: fileLength,
  },
  // S4 (first-call.md §7): the Solana order lane's three structural guarantees, optional until 4b lands the files.
  {
    id: "order-lane-ioc",
    description: "the taker's order build defaults to IOC (no resting, no self-match); only the rest lane passes post-only (first-call.md §3.1, D-088)",
    file: "packages/markets/src/submitter/steps/build.ts",
    optional: true,
    mustMatch: /ORDER_TYPE\.ioc/,
    mustNotMatch: /ORDER_TYPE\.(normal|fok|postOnly)/,
  },
  {
    id: "status-gate-enum",
    description: "the order lane gates on the on-chain Trading status enum, never a string or clock guess",
    file: "packages/markets/src/submitter/steps/status-gate.ts",
    optional: true,
    mustMatch: /ONCHAIN_STATUS\.Trading/,
  },
  {
    id: "expiry-from-headroom",
    description: "order expiry comes from core's lock-aware headroom helper",
    file: "packages/markets/src/submitter/steps/expiry.ts",
    optional: true,
    mustMatch: /orderExpirySec\(/,
  },
  // S7 (tap-trading.md §2, D-066): the tap-trading key is a non-extractable CryptoKeyPair from generation to IndexedDB.
  {
    id: "session-key-non-extractable",
    description: "the session key is generated non-extractable and never exported (no exportKey( or extractable: true); tap-trading.md §2",
    scopes: ["packages/markets/src/sessions", "web/src/features/session"],
    check: sessionKeyNonExtractable,
  },
  { id: "venue-identity", description: "no reference asset, brand or chain (BTC, ETH, Masayume, Somnia…) in live code or copy; comments and tests may name them", check: venueIdentity },
  { id: "pnpm-only", description: "pnpm is the only package manager (root pin, no foreign lockfiles, Anchor uses pnpm)", check: pnpmOnly },
];
