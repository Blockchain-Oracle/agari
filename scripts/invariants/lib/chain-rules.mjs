/**
 * The Solana-era chain boundary rules (plan §6, D-015):
 *  - no-evm:              no EVM library anywhere, with a shrinking allowlist that S1 1d empties;
 *  - kit-import-boundary: only packages/markets imports the chain SDKs (the web wallet provider island is exempt);
 *  - idl-no-destination:  AD-5 checked against the IDLs — no instruction takes a caller-chosen payout destination;
 *  - program-id-drift:    declare_id! == Anchor.toml == scripts/deploy/addresses.devnet.json. A program whose crate doesn't
 *                         exist yet (its id reserved at a stage foundation) is still held to Anchor.toml devnet == the file.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { codeLines, readText, walkFiles } from "./walk.mjs";

const SOURCE_EXTS = [".ts", ".tsx", ".mts", ".mjs", ".js"];
const WORKSPACE = ["web", "packages", "services", "scripts"];
const EXCLUDE = ["scripts/invariants", "reference"];

const readJson = (abs) => JSON.parse(readFileSync(abs, "utf8"));

/** Lines importing (statically or dynamically) any module matching `modules`. */
function* importsOf(root, scopes, modules, exclude = []) {
  const pattern = new RegExp(`(?:from\\s+|import\\s*\\(\\s*|require\\(\\s*)["'](${modules.source})`);
  for (const scope of scopes) {
    for (const { rel, abs } of walkFiles(root, scope, SOURCE_EXTS, [...EXCLUDE, ...exclude])) {
      for (const [lineNo, line] of codeLines(readText(abs))) {
        const match = pattern.exec(line);
        if (match) yield { rel, lineNo, module: match[1] };
      }
    }
  }
}

const EVM_MODULES = /viem(?:\/[\w-]+)?["']|wagmi(?:\/[\w-]+)?["']|@rainbow-me\/|@somnia-chain\/|ethers(?:\/[\w-]+)?["']/;
const EVM_DEPS = /^(viem|wagmi|ethers|@rainbow-me\/.+|@somnia-chain\/.+)$/;

export function noEvm(rule, ctx) {
  const allowPath = join(ctx.root, "scripts/invariants/no-evm.allow.json");
  const allowed = new Set(existsSync(allowPath) ? readJson(allowPath).files : []);
  const findings = [];
  const seen = new Set();
  for (const hit of importsOf(ctx.root, WORKSPACE, EVM_MODULES)) {
    seen.add(hit.rel);
    if (!allowed.has(hit.rel)) findings.push(finding(rule, `imports ${hit.module.replace(/["']$/, "")}`, `${hit.rel}:${hit.lineNo}`));
  }
  for (const { rel, abs } of walkFiles(ctx.root, ".", ["package.json"], ["reference", "anchor"])) {
    const pkg = readJson(abs);
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) {
      const key = `${rel}#${name}`;
      if (!EVM_DEPS.test(name)) continue;
      seen.add(key);
      if (!allowed.has(key)) findings.push(finding(rule, `declares ${name}`, rel));
    }
  }
  // The allowlist only shrinks: an entry that no longer offends must be deleted, so it can never hide a new import.
  for (const entry of allowed) if (!seen.has(entry)) findings.push(finding(rule, "stale allowlist entry: remove it", `no-evm.allow.json → ${entry}`));
  return findings;
}

const CHAIN_MODULES = /@solana\/|@solana-program\/|@agari\/clients|@pythnetwork\/|@switchboard-xyz\//;
const WEB3_V1_MODULES = /@solana\/web3\.js|@pythnetwork\/pyth-solana-receiver|@switchboard-xyz\/on-demand/;
const OUTSIDE_MARKETS = ["web", "packages/core", "packages/db", "packages/brain", "services", "scripts"];

export function kitImportBoundary(rule, ctx) {
  const findings = [];
  for (const hit of importsOf(ctx.root, OUTSIDE_MARKETS, CHAIN_MODULES, ["web/src/providers"])) {
    findings.push(finding(rule, `${hit.module} is imported outside packages/markets`, `${hit.rel}:${hit.lineNo}`));
  }
  for (const hit of importsOf(ctx.root, ["packages/markets"], WEB3_V1_MODULES, ["packages/markets/src/prices/legacy"])) {
    findings.push(finding(rule, `${hit.module} (web3.js 1) outside packages/markets/src/prices/legacy`, `${hit.rel}:${hit.lineNo}`));
  }
  return findings;
}

const DESTINATION_NAME = /^(destination|recipient|to|payout_?to|beneficiary|receiver)$/i;

function* idlFiles(root) {
  const idlDir = join(root, "anchor/target/idl");
  if (existsSync(idlDir)) for (const name of readdirSync(idlDir)) if (name.endsWith(".json")) yield { rel: `anchor/target/idl/${name}`, abs: join(idlDir, name) };
  for (const hit of walkFiles(root, "packages/clients", [".json"])) if (/idl[^/]*\.json$/.test(hit.rel)) yield hit;
}

function* accountNames(accounts, prefix = "") {
  for (const account of accounts ?? []) {
    if (Array.isArray(account.accounts)) yield* accountNames(account.accounts, `${prefix}${account.name}.`);
    else yield `${prefix}${account.name}`;
  }
}

export function idlNoDestination(rule, ctx) {
  const allowPath = join(ctx.root, "scripts/invariants/idl-destination.allow.json");
  const allowed = existsSync(allowPath) ? readJson(allowPath).entries ?? {} : {};
  const findings = [];
  for (const { rel, abs } of idlFiles(ctx.root)) {
    const idl = readJson(abs);
    const program = idl.metadata?.name ?? idl.name ?? rel;
    for (const ix of idl.instructions ?? []) {
      const names = [...[...accountNames(ix.accounts)].map((n) => ["account", n]), ...(ix.args ?? []).map((a) => ["arg", a.name])];
      for (const [kind, name] of names) {
        const leaf = name.split(".").at(-1);
        const key = `${program}:${ix.name}:${name}`;
        if (DESTINATION_NAME.test(leaf) && !(key in allowed)) findings.push(finding(rule, `${ix.name} takes ${kind} \`${name}\`, a caller-chosen payout destination (AD-5)`, rel));
      }
    }
  }
  return findings;
}

const snake = (name) => name.replace(/-/g, "_");

export function programIdDrift(rule, ctx) {
  const programsDir = join(ctx.root, "anchor/programs");
  const declared = new Map();
  if (existsSync(programsDir)) {
    for (const name of readdirSync(programsDir)) {
      const lib = join(programsDir, name, "src/lib.rs");
      const id = existsSync(lib) ? /declare_id!\(\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"\s*\)/.exec(readFileSync(lib, "utf8"))?.[1] : undefined;
      if (id) declared.set(snake(name), id);
    }
  }
  const findings = [];
  const tomlDevnet = new Map();
  const tomlPath = join(ctx.root, "anchor/Anchor.toml");
  if (existsSync(tomlPath)) {
    let section = null;
    for (const line of readFileSync(tomlPath, "utf8").split("\n")) {
      const header = /^\s*\[programs\.(\w+)\]\s*$/.exec(line);
      if (header) section = header[1];
      else if (/^\s*\[/.test(line)) section = null;
      const entry = section && /^\s*([\w-]+)\s*=\s*"([^"]+)"/.exec(line);
      if (entry && section === "devnet") tomlDevnet.set(snake(entry[1]), entry[2]);
      if (entry && declared.has(snake(entry[1])) && declared.get(snake(entry[1])) !== entry[2]) {
        findings.push(finding(rule, `[programs.${section}] ${entry[1]} = ${entry[2]}, declare_id! says ${declared.get(snake(entry[1]))}`, "anchor/Anchor.toml"));
      }
    }
  }
  const addressesPath = join(ctx.root, "scripts/deploy/addresses.devnet.json");
  if (existsSync(addressesPath)) {
    const json = readJson(addressesPath);
    const programs = json.programs ?? json;
    for (const [name, value] of Object.entries(programs)) {
      const id = typeof value === "string" ? value : value?.programId;
      if (typeof id === "string" && declared.has(snake(name)) && declared.get(snake(name)) !== id) {
        findings.push(finding(rule, `${name} = ${id}, declare_id! says ${declared.get(snake(name))}`, "scripts/deploy/addresses.devnet.json"));
      } else if (typeof id === "string" && !declared.has(snake(name)) && tomlDevnet.has(snake(name)) && tomlDevnet.get(snake(name)) !== id) {
        findings.push(finding(rule, `${name} = ${id}, Anchor.toml [programs.devnet] says ${tomlDevnet.get(snake(name))}`, "scripts/deploy/addresses.devnet.json"));
      }
    }
  }
  return findings;
}
