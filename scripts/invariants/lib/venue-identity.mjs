import { readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { readText, walkFiles } from "./walk.mjs";

/**
 * Agari lists stocks on Solana. The reference it was ported from listed BTC and ETH on an EVM chain, so a leftover
 * asset, brand or chain name in live code is a defect, and some were functional ones: Lucky drew from BTC/ETH and
 * could never be dealt a Window, the parlay preset looked for BTC Windows, the X reply dropped every stock's ticker,
 * and one explorer link pointed at the reference's chain (owner's note, 2026-09-19).
 *
 * Comments and tests may say what the reference did; code and copy may not, outside the allowlist.
 */
const SCOPES = ["web/src", "packages/core/src", "packages/markets/src", "packages/db/src", "services/ops/src"];
const EXTS = [".ts", ".tsx"];
const SKIP_FILE = /\.test\.tsx?$|^web\/src\/app\/dev\//;
const FORBIDDEN = /\b(btc|wbtc|eth|weth|bitcoin|ethereum|masayume|yosuku|somnia|dreamdex|flicky)\b|shannon-explorer/i;
/** A whole-line comment in TS, JSX or SQL-in-a-template. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|\{\/\*|--\s)/;
/** Trailing comments: `code; // words`, `code /* words *\/` and `{/* words *\/}`. A `//` inside a URL has no space before it. */
const TRAILING = [/\s\/\/\s.*$/, /\{?\/\*.*?\*\/\}?/g];

function stripComments(line) {
  return TRAILING.reduce((text, pattern) => text.replace(pattern, ""), line);
}

export function venueIdentity(rule, ctx) {
  const allow = JSON.parse(readFileSync(join(ctx.root, "scripts/invariants/venue-identity.allow.json"), "utf8")).entries;
  const used = new Set();
  const findings = [];
  for (const scope of SCOPES) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, EXTS)) {
      if (SKIP_FILE.test(rel)) continue;
      let inBlock = false;
      readText(abs).split("\n").forEach((raw, index) => {
        // A block comment's body lines start with `*` by this repo's style; the flag covers the ones that do not.
        if (inBlock) { if (raw.includes("*/")) inBlock = false; return; }
        if (/^\s*\/\*/.test(raw) && !raw.includes("*/")) { inBlock = true; return; }
        if (COMMENT_LINE.test(raw)) return;
        const match = FORBIDDEN.exec(stripComments(raw));
        if (!match) return;
        const entry = allow.findIndex((e) => e.file === rel && raw.includes(e.match));
        if (entry >= 0) { used.add(entry); return; }
        findings.push(finding(rule, `\`${match[0]}\` — the venue lists stocks on Solana; name what it lists, or allowlist the line with a reason`, `${rel}:${index + 1}`));
      });
    }
  }
  allow.forEach((e, i) => {
    if (!used.has(i)) findings.push(finding(rule, `stale allowlist entry (\`${e.match}\`): remove it`, e.file));
  });
  return findings;
}
