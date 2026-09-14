import { randomUUID } from "node:crypto";
import { FaucetError, SOL_FAUCET_POLICY as POLICY, faucetChallengeMessage, faucetClaimView, faucetTopUpLamports, type FaucetClaim, type FaucetStatus } from "@agari/core/faucet";
import { isAddress, isSignature } from "@agari/core/types";
import { readFaucetStore, withFaucetLock, type FaucetStore } from "@agari/db";
import type { FaucetChain } from "@agari/markets/faucet";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";

export interface FaucetServiceDeps {
  chain: FaucetChain;
  read: () => Promise<FaucetStore>;
  lock: <T>(run: (store: FaucetStore) => Promise<T>) => Promise<T>;
  now: () => number;
  id: () => string;
  /** ed25519 over the challenge text; needs no chain, so it works before the transfer path does (D-012). */
  verify: (wallet: string, message: string, signature: string) => Promise<boolean>;
}

/** A base58 wallet's signature over exactly `message`; malformed input is a plain false. */
export async function verifyChallengeSignature(wallet: string, message: string, signature: string): Promise<boolean> {
  if (!isAddress(wallet) || !isSignature(signature)) return false;
  return verifyWalletMessage({ text: message, signature, signer: wallet });
}
export function createFaucetService(chain: FaucetChain, overrides: Partial<FaucetServiceDeps> = {}) {
  const deps: FaucetServiceDeps = { chain, read: readFaucetStore, lock: withFaucetLock, now: Date.now, id: randomUUID, verify: verifyChallengeSignature, ...overrides };
  async function inspect(claim: FaucetClaim): Promise<FaucetClaim> {
    if (claim.status !== "prepared") return claim;
    const status = await deps.chain.inspect(claim);
    if (status !== "prepared") await (await deps.read()).mark(claim.id, status);
    return { ...claim, status };
  }
  async function deliver(claim: FaucetClaim): Promise<FaucetClaim> {
    const current = await inspect(claim);
    if (current.status !== "prepared") return current;
    try { await deps.chain.broadcast(current); } catch { /* A lost acknowledgement never creates a new transfer. */ }
    return inspect(current).catch(() => current);
  }
  return {
    async status(wallet: string | null): Promise<FaucetStatus> {
      const store = await deps.read();
      const [funding, balance, used, previous] = await Promise.all([
        deps.chain.balance(deps.chain.address), wallet ? deps.chain.balance(wallet) : null,
        store.used(deps.now() - POLICY.cooldownMs, ""), wallet ? store.latest(wallet) : null,
      ]);
      const current = previous ? await inspect(previous) : null;
      const amount = balance === null ? POLICY.targetLamports : faucetTopUpLamports(balance);
      const remaining = POLICY.dailyLamports > used.amountLamports ? POLICY.dailyLamports - used.amountLamports : 0n;
      const funded = funding >= POLICY.reserveLamports + amount + POLICY.maxTransferFeeLamports;
      const ready = funded && remaining >= amount;
      const nextMs = current ? current.createdAtMs + POLICY.cooldownMs : null;
      const message = current?.status === "prepared" ? "Your SOL transfer is confirming. It will not be paid twice."
        : current?.status === "conflict" ? "Your SOL transfer needs operator review. Use an external faucet meanwhile."
        : balance !== null && amount === 0n ? "You already have enough SOL for fees. Continue to get test tUSDC."
        : nextMs !== null && nextMs > deps.now() ? "This wallet has used its SOL top-up for the last 24 hours."
        : !funded ? "Our SOL faucet is waiting for a refill. External faucets are available below."
        : remaining < amount ? "Today's SOL allocation is used up. Try later or use an external faucet."
        : "Verify with a free wallet signature. Our faucet pays the transfer fee; then you can claim tUSDC.";
      return { configured: true, ready, address: deps.chain.address, fundingBalanceLamports: funding.toString(), walletBalanceLamports: balance?.toString() ?? null, dailyRemainingLamports: remaining.toString(), targetLamports: POLICY.targetLamports.toString(), thresholdLamports: POLICY.thresholdLamports.toString(), claim: current ? faucetClaimView(current) : null, message };
    },
    async challenge(wallet: string, ipHash: string, origin: string) {
      const nowMs = deps.now();
      return deps.lock(async (store) => {
        const counts = await store.challengeCounts(wallet, ipHash, nowMs - 3_600_000);
        if (counts.wallet >= 6 || counts.ip >= 20 || counts.total >= 300) throw new FaucetError("rate-limited", "Too many SOL requests. Please try again later.", 429);
        const id = deps.id();
        const expiresAtMs = nowMs + POLICY.challengeTtlMs;
        const message = faucetChallengeMessage({ origin, wallet, id, expiresAtMs });
        await store.addChallenge({ id, wallet, ipHash, message, createdAtMs: nowMs, expiresAtMs });
        return { id, message, expiresAtMs };
      });
    },
    async claim(id: string, signature: string, ipHash: string) {
      const store = await deps.read();
      const challenge = await store.challenge(id);
      if (!challenge) throw new FaucetError("challenge-missing", "Request a new wallet verification message.", 400);
      const existing = await store.claim(id);
      if (!existing && challenge.expiresAtMs <= deps.now()) throw new FaucetError("challenge-expired", "Wallet verification expired. Please try again.", 400);
      if (!existing && challenge.ipHash !== ipHash) throw new FaucetError("request-changed", "Your connection changed. Please request a new verification message.", 400);
      if (!await deps.verify(challenge.wallet, challenge.message, signature)) throw new FaucetError("signature-invalid", "The signature does not match this wallet request.", 403);

      // A signed retry may recover its existing transfer even after the message expired.
      if (existing) return faucetClaimView(await deliver(existing));
      const pending = await store.pending();
      if (pending) await deliver(pending);

      const reserved = await deps.lock(async (locked) => {
        const duplicate = await locked.claim(id);
        if (duplicate) return duplicate;
        const nowMs = deps.now();
        if (challenge.expiresAtMs <= nowMs) throw new FaucetError("challenge-expired", "Wallet verification expired. Please try again.", 400);
        const unresolved = await locked.pending();
        if (unresolved) throw new FaucetError("pending-transfer", "A SOL transfer is still being checked. Please try again shortly.");
        const previous = await locked.latest(challenge.wallet);
        if (previous && previous.createdAtMs + POLICY.cooldownMs > nowMs) throw new FaucetError("cooldown", "This wallet can request another SOL top-up 24 hours after its last request.", 429);
        const used = await locked.used(nowMs - POLICY.cooldownMs, ipHash);
        if (used.ip >= POLICY.maxPerIpPerDay) throw new FaucetError("rate-limited", "This connection has reached its daily SOL allocation.", 429);
        const balance = await deps.chain.balance(challenge.wallet);
        const amountLamports = faucetTopUpLamports(balance);
        if (amountLamports === 0n) throw new FaucetError("already-funded", "You already have enough SOL for fees. Continue to get test tUSDC.");
        if (used.amountLamports + amountLamports > POLICY.dailyLamports) throw new FaucetError("daily-limit", "Today's SOL allocation is used up. Try later or use an external faucet.", 429);
        const funding = await deps.chain.balance(deps.chain.address);
        if (funding < POLICY.reserveLamports + amountLamports) throw new FaucetError("refill-needed", "Our SOL faucet is waiting for a refill. Please use an external faucet for now.", 503);
        const prepared = await deps.chain.prepare(challenge.wallet, amountLamports);
        if (funding < POLICY.reserveLamports + amountLamports + BigInt(prepared.feeLamports)) throw new FaucetError("refill-needed", "Our SOL faucet is waiting for a refill. Please use an external faucet for now.", 503);
        const record: FaucetClaim = { id, wallet: challenge.wallet, funder: deps.chain.address, ipHash, amountLamports: amountLamports.toString(), ...prepared, status: "prepared", createdAtMs: nowMs };
        await locked.insert(record);
        return record;
      });
      // withFaucetLock has committed the signed bytes, last valid block height and signature before this line.
      return faucetClaimView(await deliver(reserved));
    },
  };
}
