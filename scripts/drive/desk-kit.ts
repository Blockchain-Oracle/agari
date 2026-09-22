// S21 C6 (D-126): what the desk rehearsal shares between its files. Arguments, the fork's key directory (copies of
// the mainnet role keys plus a fresh owner and a stranger), the owner's ed25519 signature over a mandate text (node
// crypto: scripts never import a Solana SDK), the program deploy through the Solana CLI, and the evidence ledger every
// check writes to. Fork only: `assertLocalRpc` refuses any RPC that is not loopback before a single key is read.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign as signRaw, verify as verifyRaw } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { decodeBase58, encodeBase58 } from "@agari/core/types";
import { arg, flag } from "../deploy/ops-cluster";

export const FORK_ROLES = ["deployer", "desk-runner", "price-attestor"] as const;
export const SOLANA_BIN = join(homedir(), ".local", "share", "solana", "install", "active_release", "bin");

export interface RehearsalArgs {
  rpcUrl: string;
  wsUrl: string;
  outDir: string;
  keysDir: string;
  mainnetKeysDir: string;
  programSo: string;
  programKeypair: string;
  /** `ACT_NOW` (default), `WAIT`, `DECLINE`, or `none` for the real model. */
  modelStub: string;
  phases: Set<string>;
  skipDeploy: boolean;
  maxWarmSec: number;
}

export function rehearsalArgs(): RehearsalArgs {
  const outDir = arg("--out", join(".agari", "desk-rehearsal"));
  const a: RehearsalArgs = {
    rpcUrl: arg("--rpc-url", "http://127.0.0.1:8999"),
    wsUrl: arg("--ws-url", "ws://127.0.0.1:8998"),
    outDir,
    keysDir: arg("--keys", join(outDir, "keys")),
    mainnetKeysDir: arg("--mainnet-keys", join(homedir(), ".config", "agari", "mainnet")),
    programSo: arg("--program-so", join("anchor", "target", "deploy", "agari_desk.so")),
    programKeypair: arg("--program-keypair", join(homedir(), ".config", "agari", "devnet", "agari-desk-program.json")),
    modelStub: arg("--model-stub", "ACT_NOW"),
    phases: new Set(arg("--phases", "A,B,C,D,E,F,G").split(",").map((p) => p.trim().toUpperCase())),
    skipDeploy: flag("--skip-deploy"),
    maxWarmSec: Number(arg("--max-warm-sec", "180")),
  };
  assertLocalRpc(a.rpcUrl);
  assertLocalRpc(a.wsUrl);
  mkdirSync(a.outDir, { recursive: true });
  return a;
}

/** The rehearsal touches one chain: a fork on this machine. Anything else is refused before a key is read. */
export function assertLocalRpc(url: string): void {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") throw new Error(`${url} is not a loopback RPC: the rehearsal never touches a real cluster`);
}

export interface ForkKeys {
  dir: string;
  /** `role → 64-byte keypair`; the owner is fresh every run, the stranger too. */
  secret: (role: string) => Uint8Array;
  pubkey: (role: string) => string;
  ownerRole: string;
}

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function newKeypairBytes(): number[] {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });
  return [...Buffer.from(jwk.d as string, "base64url"), ...Buffer.from(jwk.x as string, "base64url")];
}

const readKeypair = (path: string): Uint8Array => {
  const bytes = JSON.parse(readFileSync(path, "utf8")) as number[];
  if (!Array.isArray(bytes) || bytes.length !== 64) throw new Error(`${path} is not a 64-byte Solana keypair`);
  return Uint8Array.from(bytes);
};

/**
 * The fork's keys: copies of the mainnet deployer, desk-runner and price-attestor (so the rehearsal signs with the
 * keys the real deploy will), the program keypair, a fresh owner for this run and a stranger for the attestor check.
 * Mode 0600; secrets are never printed.
 */
export function ensureForkKeys(a: RehearsalArgs, runId: string): ForkKeys {
  mkdirSync(a.keysDir, { recursive: true, mode: 0o700 });
  for (const role of FORK_ROLES) {
    const to = join(a.keysDir, `${role}.json`);
    if (existsSync(to)) continue;
    const from = join(a.mainnetKeysDir, `${role}.json`);
    if (!existsSync(from)) throw new Error(`${from} is missing: make the mainnet role keys first (AGARI_KEYS_DIR=${a.mainnetKeysDir} pnpm roles)`);
    copyFileSync(from, to);
  }
  const programTo = join(a.keysDir, "agari-desk-program.json");
  if (!existsSync(programTo)) copyFileSync(a.programKeypair, programTo);
  const ownerRole = `owner-${runId}`;
  for (const role of [ownerRole, "stranger"]) {
    const path = join(a.keysDir, `${role}.json`);
    if (!existsSync(path)) writeFileSync(path, JSON.stringify(newKeypairBytes()), { mode: 0o600, flag: "wx" });
  }
  const secret = (role: string) => readKeypair(join(a.keysDir, `${role}.json`));
  return { dir: a.keysDir, secret, pubkey: (role) => encodeBase58(secret(role).subarray(32)), ownerRole };
}

/** The owner's ed25519 signature over `text`, base58, as a Wallet Standard `signMessage` would return it. */
export function signOwnerText(secret: Uint8Array, text: string): string {
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(secret.subarray(0, 32))]), format: "der", type: "pkcs8" });
  return encodeBase58(new Uint8Array(signRaw(null, Buffer.from(text, "utf8"), key)));
}

/** Verifies a base58 ed25519 signature over `text` by `signer` (base58): the check the API route makes. */
export function verifyOwnerText(signer: string, text: string, signature: string): boolean {
  const publicKey = decodeBase58(signer);
  const bytes = decodeBase58(signature);
  if (!publicKey || !bytes || publicKey.length !== 32 || bytes.length !== 64) return false;
  const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKey)]), format: "der", type: "spki" });
  return verifyRaw(null, Buffer.from(text, "utf8"), key, Buffer.from(bytes));
}

export const sha256File = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

const withSolanaOnPath = () => ({ ...process.env, PATH: `${SOLANA_BIN}:${process.env.PATH ?? ""}` });

/** `solana program deploy` to the fork through its RPC (Surfpool has no TPU); returns the deploy signature. */
export function deployProgram(a: RehearsalArgs, keys: ForkKeys): { signature: string; output: string } {
  const args = ["program", "deploy", "--url", a.rpcUrl, "--use-rpc", "--keypair", join(keys.dir, "deployer.json"), "--upgrade-authority", join(keys.dir, "deployer.json"), "--program-id", join(keys.dir, "agari-desk-program.json"), a.programSo];
  const output = execFileSync("solana", args, { env: withSolanaOnPath(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const signature = /Signature:\s*([1-9A-HJ-NP-Za-km-z]{32,})/.exec(output)?.[1];
  if (!signature) throw new Error(`solana program deploy printed no signature:\n${output}`);
  return { signature, output: output.trim() };
}

/** `scripts/deploy/init-desk.ts --cluster localnet` as the real deploy will run it, against the fork. */
export function runInitDesk(a: RehearsalArgs, addressesPath: string, extra: string[] = []): string {
  const args = ["exec", "tsx", "--env-file-if-exists=.env.local", "scripts/deploy/init-desk.ts", "--cluster", "localnet", "--rpc-url", a.rpcUrl, "--ws-url", a.wsUrl, "--addresses", addressesPath, ...extra];
  return execFileSync("pnpm", args, { env: { ...process.env, AGARI_KEYS_DIR: a.keysDir }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export interface CheckRow {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
  signatures: string[];
  ms: number;
  error?: string;
}

/** The numbered checks, printed as they run and written whole to `evidence.json` after every one. */
export class Evidence {
  readonly rows: CheckRow[] = [];
  readonly facts: Record<string, unknown> = {};
  constructor(readonly path: string, readonly meta: Record<string, unknown>) {}

  async check(id: string, title: string, run: () => Promise<{ detail: string; signatures?: string[] }>): Promise<boolean> {
    const started = Date.now();
    process.stdout.write(`${id.padEnd(4)} ${title} … `);
    try {
      const { detail, signatures = [] } = await run();
      this.rows.push({ id, title, ok: true, detail, signatures, ms: Date.now() - started });
      console.log(`ok (${Date.now() - started} ms)\n     ${detail}${signatures.length ? `\n     ${signatures.join("\n     ")}` : ""}`);
    } catch (error) {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.rows.push({ id, title, ok: false, detail: "", signatures: [], ms: Date.now() - started, error: message });
      console.log(`FAILED (${Date.now() - started} ms)\n     ${message.split("\n").slice(0, 6).join("\n     ")}`);
    }
    this.write();
    return this.rows.at(-1)?.ok ?? false;
  }

  fact(key: string, value: unknown): void {
    this.facts[key] = value;
    this.write();
  }

  write(): void {
    const body = { ...this.meta, writtenAt: new Date().toISOString(), passed: this.rows.filter((r) => r.ok).length, failed: this.rows.filter((r) => !r.ok).length, checks: this.rows, facts: this.facts };
    writeFileSync(this.path, `${JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}\n`);
  }

  /** The table for the report: one row per check, the fork signatures in code spans. */
  table(): string {
    const lines = ["| # | Check | Result | Detail | Fork signature(s) |", "|---|---|---|---|---|"];
    for (const r of this.rows) {
      const sigs = r.signatures.map((s) => `\`${s.slice(0, 8)}…${s.slice(-6)}\``).join(" · ") || "—";
      const detail = (r.ok ? r.detail : (r.error ?? "").split("\n")[0] ?? "").replace(/\|/g, "\\|");
      lines.push(`| ${r.id} | ${r.title} | ${r.ok ? "✅ pass" : "❌ FAIL"} | ${detail} | ${sigs} |`);
    }
    return lines.join("\n");
  }
}

export const nowSec = () => Math.floor(Date.now() / 1000);
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const bpsOf = (part: bigint, whole: bigint): number => (whole === 0n ? 0 : Number((part * 10_000n) / whole));
