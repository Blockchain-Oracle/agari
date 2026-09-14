import type { AnyFaucetClaimView, FaucetAsset, FaucetClaimView, FaucetStatus, TusdcFaucetClaimView } from "@agari/core/faucet";

export type FundingStage = "idle" | "checking" | "verifying" | "adding-gas" | "minting" | "ready";
export const FUNDING_STAGE_LABEL: Record<FundingStage, string> = { idle: "Get test funds", checking: "Checking balances…", verifying: "Verify wallet — no fee", "adding-gas": "Adding SOL for fees…", minting: "Adding test tUSDC…", ready: "Ready" };

/** The server answered and refused (quota, cooldown, expiry): nothing was reserved by this call. */
export class FaucetRefusal extends Error {}
export async function faucetJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(body === undefined ? 15_000 : 55_000) });
  const result = await response.json();
  if (!response.ok) throw new FaucetRefusal(typeof result.error === "string" ? result.error : "The test funds service is unavailable. Please retry.");
  return result as T;
}
export const readGasStatus = (wallet: string) => faucetJson<FaucetStatus>(`/api/faucet?wallet=${wallet}`);

interface SignedRequest { id: string; signature: string }
// Base58 is case-sensitive: the key is the address exactly as written (D-010).
const storageKey = (wallet: string) => `agari.faucet.gas-request.${wallet}`;
function savedRequest(wallet: string): SignedRequest | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(wallet)) ?? "null");
    return value && typeof value.id === "string" && typeof value.signature === "string" ? value : null;
  } catch { return null; }
}
type ViewOf<A extends FaucetAsset> = A extends "sol" ? FaucetClaimView : TusdcFaucetClaimView;
const claimOf = (status: FaucetStatus | null, asset: FaucetAsset): AnyFaucetClaimView | null => (asset === "sol" ? status?.claim : status?.tusdc?.claim) ?? null;

/** A claim that was sent but not yet decided: retrying checks the same transaction, it never signs a new one. */
export class PendingClaimError extends Error {}

export interface FundsRequestInput { wallet: string; status: FaucetStatus; sign: (message: string) => Promise<string>; current: () => boolean; stage: (stage: FundingStage) => void }

/**
 * One signed request for a run (D-034): the first claim asks for the challenge signature, every later claim reuses it.
 * A saved signature is resumed only for a claim that is still prepared. Clearing browser storage never clears the
 * server's limits, and `finish` keeps the signature while any claim is left unconfirmed.
 */
export function fundsRequest(input: FundsRequestInput) {
  const { wallet, current, stage } = input;
  const guard = () => { if (!current()) throw new Error("Wallet changed. Open test funds again for the connected wallet."); };
  let signed = savedRequest(wallet);
  if (!signed || ![claimOf(input.status, "sol"), claimOf(input.status, "tusdc")].some((c) => c?.status === "prepared" && c.id === signed?.id)) signed = null;
  const unresolved = new Set<FaucetAsset>();

  async function claim<A extends FaucetAsset>(asset: A, onClaim: (claim: ViewOf<A>) => void): Promise<ViewOf<A>> {
    const report = (view: AnyFaucetClaimView) => onClaim(view as ViewOf<A>);
    if (!signed) {
      guard();
      const challenge = await faucetJson<{ id: string; message: string }>("/api/faucet/challenge", { wallet });
      guard(); stage("verifying");
      const signature = await input.sign(challenge.message);
      guard();
      signed = { id: challenge.id, signature };
      try { sessionStorage.setItem(storageKey(wallet), JSON.stringify(signed)); } catch { /* Server limits still apply. */ }
    }
    stage(asset === "sol" ? "adding-gas" : "minting"); guard();
    unresolved.add(asset);
    let result = (await faucetJson<{ claim: AnyFaucetClaimView }>("/api/faucet", { ...signed, asset }).catch((error: unknown) => {
      // A refusal reserved nothing; a lost response may have, so the signature is kept for the retry.
      if (error instanceof FaucetRefusal) unresolved.delete(asset);
      throw error;
    })).claim;
    report(result);
    for (let attempt = 0; result.status === "prepared" && attempt < 10; attempt++) {
      guard();
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      guard();
      const polled = claimOf(await readGasStatus(wallet), asset);
      if (polled?.id === result.id) result = polled;
      report(result);
    }
    guard();
    const noun = asset === "sol" ? "SOL transfer" : "tUSDC claim";
    if (result.status === "prepared") throw new PendingClaimError(`Your ${noun} is still confirming. Retry to check the same ${noun}; nothing will be sent twice.`);
    unresolved.delete(asset);
    if (result.status === "confirmed") return result as ViewOf<A>;
    throw new Error(result.status === "reverted" ? `The ${noun} failed. ${asset === "sol" ? "Please use an external faucet for now." : "Please try again later."}` : `The ${noun} needs operator review.${asset === "sol" ? " Please use an external faucet for now." : ""}`);
  }
  return {
    claim,
    /** Forget the signature once nothing it covers is still confirming. */
    finish() {
      if (unresolved.size > 0) return;
      try { sessionStorage.removeItem(storageKey(wallet)); } catch { /* optional browser storage */ }
    },
  };
}

/** The SOL top-up alone (Masayume's gas request): sign if needed, claim, poll. */
export async function requestGas(input: FundsRequestInput & { onClaim: (claim: FaucetClaimView) => void }): Promise<void> {
  const request = fundsRequest(input);
  try { await request.claim("sol", input.onClaim); } finally { request.finish(); }
}
