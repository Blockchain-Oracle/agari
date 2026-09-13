/**
 * The checked-in rule table that keeps the architecture spine honest in CI, with no network.
 * Rule shapes:
 *  - pattern rules: { scopes, exts, exclude?, pattern } — every non-comment line matching `pattern` is a finding
 *  - file rules:    { file, mustMatch?, mustNotMatch?, optional? } — a single file's content is asserted
 *  - check rules:   { check(ctx) } — arbitrary logic returning findings
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { finding } from "./lib/report.mjs";
import { walkFiles, readText } from "./lib/walk.mjs";

const TS = [".ts", ".tsx"];
const VAULT_ABI = "packages/markets/src/contracts/event-vault.abi.ts";
const OUTSIDE_MARKETS = ["web", "packages/core", "packages/db", "services", "scripts"];
const MAX_FILE_LINES = 400;
export const SDK_NAME = "@somnia-chain/markets-sdk";
export const SDK_PINNED_VERSION = "0.28.1";

function fileLength(rule, ctx) {
  const findings = [];
  for (const scope of rule.scopes) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, rule.exts)) {
      const lines = readText(abs).split("\n").length;
      if (lines > MAX_FILE_LINES) findings.push(finding(rule, `${lines} lines (max ${MAX_FILE_LINES})`, rel));
    }
  }
  return findings;
}

function sdkVersionPin(rule, ctx) {
  const findings = [];
  const pkg = JSON.parse(readFileSync(join(ctx.root, "packages/markets/package.json"), "utf8"));
  const declared = pkg.dependencies?.[SDK_NAME];
  if (declared !== SDK_PINNED_VERSION) {
    findings.push(finding(rule, `packages/markets declares ${SDK_NAME}@${declared}, expected exact ${SDK_PINNED_VERSION}`));
  }
  const lockPath = join(ctx.root, "pnpm-lock.yaml");
  if (!existsSync(lockPath)) return [finding(rule, "pnpm-lock.yaml missing")];
  const lock = readFileSync(lockPath, "utf8");
  const versions = new Set([...lock.matchAll(/@somnia-chain\/markets-sdk@([0-9][^\s(:'"]*)/g)].map((m) => m[1]));
  for (const v of versions) {
    if (v !== SDK_PINNED_VERSION) findings.push(finding(rule, `lockfile resolves ${SDK_NAME}@${v}`));
  }
  return findings;
}

/** The vault's ABI, parsed from the generated module so the rule reads what the app reads. */
function vaultAbi(ctx) {
  const text = readFileSync(join(ctx.root, VAULT_ABI), "utf8");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  // The generated module writes one entry per line with a trailing comma; JSON does not allow one.
  return JSON.parse(text.slice(start, end + 1).replace(/,\s*\]$/, "]"));
}

/** AD-10 at the ABI: no event of the vault carries a pool address; AD-5: no withdrawal names a destination. */
function vaultAbiShape(rule, ctx) {
  if (!existsSync(join(ctx.root, VAULT_ABI))) return [];
  const findings = [];
  for (const entry of vaultAbi(ctx)) {
    if (entry.type === "event") {
      for (const input of entry.inputs) {
        if (input.type === "address" && /pool/i.test(input.name)) findings.push(finding(rule, `event ${entry.name} carries ${input.name}: address`, VAULT_ABI));
      }
    }
    if (entry.type === "function" && /^withdraw/.test(entry.name)) {
      if (entry.inputs.some((input) => input.type === "address")) findings.push(finding(rule, `${entry.name} takes an address — a payout destination`, VAULT_ABI));
    }
  }
  return findings;
}

async function addressDrift(rule, ctx) {
  const pinnedPath = join(ctx.root, "packages/markets/src/addresses.pinned.json");
  const pinned = JSON.parse(readFileSync(pinnedPath, "utf8"));
  const require = createRequire(join(ctx.root, "packages/markets/package.json"));
  const sdk = await import(pathToFileURL(require.resolve(SDK_NAME)).href);
  const live = sdk.SOMNIA_TESTNET_ADDRESSES;
  const findings = [];
  for (const [key, expected] of Object.entries(pinned.addresses)) {
    const actual = live[key];
    if (typeof actual !== "string" || actual.toLowerCase() !== expected.toLowerCase()) {
      findings.push(finding(rule, `${key}: pinned ${expected}, SDK ships ${String(actual)}`));
    }
  }
  for (const key of Object.keys(live)) {
    if (key !== "lend" && !(key in pinned.addresses)) findings.push(finding(rule, `SDK ships ${key}=${live[key]} which is not pinned`));
  }
  if (pinned.sdkVersion !== SDK_PINNED_VERSION) findings.push(finding(rule, `pinned file says SDK ${pinned.sdkVersion}`));
  return findings;
}

export const rules = [
  {
    id: "sdk-import-boundary",
    description: "only packages/markets may import the SDK (AD-1)",
    scopes: OUTSIDE_MARKETS,
    exts: [...TS, ".mjs", ".js"],
    exclude: ["scripts/invariants"],
    pattern: /from\s+["']@somnia-chain\//,
  },
  {
    id: "write-boundary",
    description: "no chain writes outside packages/markets (AD-3)",
    scopes: OUTSIDE_MARKETS,
    exts: TS,
    pattern: /\b(writeContract|sendTransaction|sendRawTransaction)\s*\(/,
  },
  {
    id: "banned-wagmi-hooks",
    description: "wagmi read hooks are banned in product code; reads come through the port (AD-14)",
    scopes: ["web/src", "services"],
    exts: TS,
    pattern: /\b(useBalance|useReadContract|useReadContracts|usePublicClient|useClient|useBlockNumber|useWatchContractEvent)\b/,
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
    scopes: ["web/src", "packages", "services", "scripts", "contracts/src", "contracts/test", "contracts/script"],
    exts: [...TS, ".mjs", ".css", ".sol"],
    check: fileLength,
  },
  {
    id: "generated-abi",
    description: "contract ABIs reach the app only through the generated module (AD-10)",
    file: VAULT_ABI,
    mustMatch: /^\/\/ Generated by contracts\/export\.mjs/,
    optional: true,
  },
  { id: "vault-abi-shape", description: "no pool address in a vault event; no withdrawal takes a destination (AD-10, AD-5)", check: vaultAbiShape },
  { id: "sdk-version-pin", description: `${SDK_NAME} is pinned to exactly ${SDK_PINNED_VERSION}`, check: sdkVersionPin },
  { id: "address-drift", description: "pinned protocol addresses match the installed SDK", check: addressDrift },
  {
    id: "order-lane-ioc",
    description: "takers send IOC — the order lane never rests a remainder (canon #7)",
    file: "packages/markets/src/submitter/steps/send.ts",
    mustMatch: /ORDER_TYPE\.MARKET/,
    mustNotMatch: /ORDER_TYPE\.(LIMIT|POST_ONLY|FILL_OR_KILL)/,
    optional: true,
  },
  {
    id: "status-gate-enum",
    description: "every order gates on the on-chain Trading status (canon #1)",
    file: "packages/markets/src/submitter/steps/status-gate.ts",
    mustMatch: /ONCHAIN_STATUS\.Trading/,
    optional: true,
  },
  {
    id: "expiry-from-headroom",
    description: "order expiry always derives from the headroom formula (canon #6, #9)",
    file: "packages/markets/src/submitter/steps/expiry.ts",
    mustMatch: /orderExpirySec\(/,
    optional: true,
  },
];
