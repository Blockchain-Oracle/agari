import type { FaucetClaimView, FaucetStatus } from "@masayume/core/faucet";

export type FundingStage = "idle" | "checking" | "verifying" | "adding-gas" | "minting" | "ready";
export const FUNDING_STAGE_LABEL: Record<FundingStage, string> = { idle: "Get test funds", checking: "Checking balances…", verifying: "Verify wallet — no gas fee", "adding-gas": "Adding STT for gas…", minting: "Confirm test tUSDC in your wallet…", ready: "Ready" };

export async function faucetJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(body === undefined ? 15_000 : 55_000) });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The gas service is unavailable. Please retry.");
  return result as T;
}
export const readGasStatus = (wallet: string) => faucetJson<FaucetStatus>(`/api/faucet?wallet=${wallet}`);

interface GasRequest { id: string; signature: string }
const storageKey = (wallet: string) => `masayume.faucet.gas-request.${wallet.toLowerCase()}`;
function savedRequest(wallet: string): GasRequest | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(wallet)) ?? "null");
    return value && typeof value.id === "string" && typeof value.signature === "string" ? value : null;
  } catch { return null; }
}

/** Resume only the same signed request. Clearing browser storage never clears the server's limits. */
export async function requestGas(input: { wallet: string; status: FaucetStatus; sign: (message: string) => Promise<string>; current: () => boolean; stage: (stage: FundingStage) => void; onClaim: (claim: FaucetClaimView) => void }): Promise<void> {
  const { wallet, current, stage, onClaim } = input;
  const guard = () => { if (!current()) throw new Error("Wallet changed. Open test funds again for the connected wallet."); };
  let saved = savedRequest(wallet);
  if (input.status.claim?.status !== "prepared" || input.status.claim.id !== saved?.id) saved = null;
  if (!saved) {
    guard();
    const challenge = await faucetJson<{ id: string; message: string }>("/api/faucet/challenge", { wallet });
    guard(); stage("verifying");
    const signature = await input.sign(challenge.message);
    guard();
    saved = { id: challenge.id, signature };
    try { sessionStorage.setItem(storageKey(wallet), JSON.stringify(saved)); } catch { /* Server limits still apply. */ }
  }
  stage("adding-gas"); guard();
  let { claim } = await faucetJson<{ claim: FaucetClaimView }>("/api/faucet", saved);
  onClaim(claim);
  for (let attempt = 0; claim.status === "prepared" && attempt < 10; attempt++) {
    guard();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    guard();
    const status = await readGasStatus(wallet);
    if (status.claim?.id === claim.id) claim = status.claim;
    onClaim(claim);
  }
  guard();
  if (claim.status === "confirmed") {
    try { sessionStorage.removeItem(storageKey(wallet)); } catch { /* optional browser storage */ }
    return;
  }
  if (claim.status === "prepared") throw new Error("Your STT transfer is still confirming. Retry to check the same transfer; no second payment will be sent.");
  throw new Error(claim.status === "reverted" ? "The STT transfer reverted. Please use an external faucet for now." : "The STT transfer needs operator review. Please use an external faucet for now.");
}
