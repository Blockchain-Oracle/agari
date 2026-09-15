// Shared pieces of the vault drive (scripts/drive/vault.ts): the runtime re-pointed at the vault program, owner and
// session-key sessions, a counting sponsor co-signer, and chain views of what each step changed.

import { writeFileSync } from "node:fs";
import {
  configureMarkets, createSessionKeySession, createSubmitterSession, getVaultSnapshot, loadVaultDeployment, localCosigner, parseMarketsEnv,
  readSeat, readTokenBalance, solana, type SessionKey, type SponsorCosigner, type WriteRpc,
} from "@agari/markets";
import { keypairSigner } from "@agari/markets/deploy";
import type { Address, MarketId, OnchainSnapshot } from "@agari/core";
import { marketsProvider } from "@agari/markets";
import { fileJournal, type Drive, type User } from "./first-call-kit";

export const VAULT_PROGRAM_ID = "84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9";
export const TUSDC = 1_000_000n;
const jsonSafe = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);

/** The drive's env: the fork's endpoints plus the vault program id, so the runtime's vault probe reads the fork. */
export function vaultEnv(d: Drive) {
  return parseMarketsEnv({ cluster: d.cluster, rpcHttpUrls: d.rpcUrl, rpcWsUrls: d.wsUrl, vaultProgramId: VAULT_PROGRAM_ID });
}

export async function pointAtVault(d: Drive) {
  configureMarkets(vaultEnv(d));
  const deployment = await loadVaultDeployment();
  if (!deployment) throw new Error(`no VaultConfig for ${VAULT_PROGRAM_ID} on ${d.rpcUrl}`);
  return deployment;
}

/** The sponsor role as a co-signer that counts every request, so "no co-sign request" is checkable. */
export async function countingSponsor(d: Drive): Promise<{ cosigner: SponsorCosigner; address: string; calls: () => number }> {
  const signer = await keypairSigner(d.secretOf("sponsor"));
  const inner = localCosigner(signer);
  let calls = 0;
  return {
    address: signer.address,
    calls: () => calls,
    cosigner: {
      sponsor: inner.sponsor,
      cosign: (request) => {
        calls += 1;
        return inner.cosign(request);
      },
    },
  };
}

export function ownerSession(d: Drive, user: User, journalPath: string, sponsor?: SponsorCosigner, rpc?: WriteRpc) {
  return createSubmitterSession({
    env: vaultEnv(d), authority: "user-wallet", signer: { secretKey: user.secret }, journal: fileJournal(journalPath, d.clock.nowMs), nowMs: d.clock.nowMs,
    ...(sponsor ? { sponsor } : {}), ...(rpc ? { rpc } : {}),
  });
}

export function keySession(d: Drive, key: SessionKey, journalPath: string, sponsor: SponsorCosigner, rpc?: WriteRpc) {
  return createSessionKeySession({ env: vaultEnv(d), keyPair: key.keyPair, journal: fileJournal(journalPath, d.clock.nowMs), nowMs: d.clock.nowMs, sponsor, ...(rpc ? { rpc } : {}) });
}

/** Who paid and who signed a landed transaction: static key 0 is the fee payer; the first N keys signed. */
export async function signersOf(signature: string) {
  const tx = await solana().rpc.getTransaction(signature as never, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
  if (!tx) throw new Error(`transaction ${signature} not readable`);
  const { message } = tx.transaction;
  const count = message.header.numRequiredSignatures;
  return { feePayer: message.accountKeys[0] as string, signers: message.accountKeys.slice(0, count).map(String), fee: tx.meta?.fee ?? 0n, computeUnits: tx.meta?.computeUnitsConsumed ?? null, raw: tx };
}

export async function lamports(address: string): Promise<bigint> {
  return (await solana().rpc.getBalance(address as never, { commitment: "confirmed" }).send()).value;
}

/** The owner's Trading Balance and session grant, head-fresh. */
export async function vaultState(owner: string) {
  const reading = await getVaultSnapshot(owner as Address);
  if (!reading.ok || !reading.value) throw new Error(`no vault snapshot for ${owner}`);
  return { available: reading.value.account.availableBase, session: reading.value.grants.session, executor: reading.value.grants.executor };
}

export async function vaultHeld(owner: string, onchain: OnchainSnapshot) {
  const reading = await marketsProvider.getVaultHoldings(owner as Address, onchain);
  if (!reading.ok) throw new Error(`holdings: ${reading.error.technical}`);
  return reading.value;
}

export async function onchainOf(marketId: string): Promise<OnchainSnapshot> {
  const reading = await marketsProvider.getOnchain(marketId as MarketId);
  if (!reading.ok) throw new Error(`onchain: ${reading.error.technical}`);
  return reading.value;
}

export async function tokenOf(owner: string, mint: string): Promise<bigint> {
  return (await readTokenBalance(owner as never, mint as never)).amountBase ?? 0n;
}

export async function walletHeld(ledger: string, mint: string, owner: string) {
  const [seat, token] = await Promise.all([readSeat(ledger as never, owner as never), readTokenBalance(owner as never, mint as never)]);
  return { seat: seat?.seat ?? null, tokenBase: token.amountBase ?? 0n };
}

/** A landed transaction's JSON, kept as an indexer fixture (no secrets: only public keys and signatures). */
export async function saveFixture(signature: string, path: string, note: string) {
  const { raw } = await signersOf(signature);
  writeFileSync(path, `${JSON.stringify({ note, transaction: raw }, jsonSafe, 2)}\n`);
}

export function saveVaultEvidence(d: Drive, path: string, extra: Record<string, unknown>) {
  writeFileSync(path, `${JSON.stringify({ cluster: d.cluster, ...extra, evidence: d.evidence }, jsonSafe, 2)}\n`);
  console.log(`evidence → ${path}`);
}
