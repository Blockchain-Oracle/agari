/**
 * Proof accounts stay open 24 h so anyone can read them on an explorer, then give their rent back (Q-S5-7). The
 * stored decode and the post signatures stay on the page after the close. Leftovers no verified row names (a run that
 * died between post and store) are closed too, unless a run is posting right now.
 */
import { closePythUpdates } from "../prices/legacy";
import { keypairAddress } from "../sessions/keypair";
import { payerPriceUpdates } from "./chain";
import { POSTING_STALE_MS, redactError } from "./replay";
import type { ProofStore } from "./store";

export const PROOF_KEEP_SEC = 86_400;

export interface CloseReport {
  closed: Array<{ boundarySec: number; feeds: string[]; addresses: string[]; signatures: string[] }>;
  orphans: { addresses: string[]; signatures: string[] };
  skippedOrphans: string | null;
  errors: string[];
}

export async function closeProofAccounts(deps: { store: ProofStore; rpcUrl: string; payerSecret: Uint8Array; nowMs?: () => number }, olderThanSec = PROOF_KEEP_SEC): Promise<CloseReport> {
  const now = deps.nowMs ?? Date.now;
  const report: CloseReport = { closed: [], orphans: { addresses: [], signatures: [] }, skippedOrphans: null, errors: [] };
  const open = await deps.store.openProofs();
  const cutoffMs = now() - olderThanSec * 1000;
  const due = new Map<number, typeof open>();
  for (const proof of open) if (proof.postedAtMs <= cutoffMs) due.set(proof.boundarySec, [...(due.get(proof.boundarySec) ?? []), proof]);

  // One close per boundary: its three accounts fit one transaction, so the row's close signature is that transaction.
  for (const [boundarySec, proofs] of due) {
    const addresses = proofs.map((p) => p.priceUpdate);
    try {
      const signatures = await closePythUpdates({ rpcUrl: deps.rpcUrl, payerSecret: deps.payerSecret, addresses });
      await deps.store.closed(proofs, signatures.join(","), now());
      report.closed.push({ boundarySec, feeds: proofs.map((p) => p.feed), addresses, signatures });
    } catch (error) {
      report.errors.push(`${boundarySec}: ${redactError(error)}`);
    }
  }

  const { posting } = await deps.store.activity(now(), POSTING_STALE_MS, now());
  if (posting > 0) {
    report.skippedOrphans = `${posting} proof run(s) posting now`;
    return report;
  }
  const named = new Set(open.map((p) => p.priceUpdate));
  const orphans = (await payerPriceUpdates(deps.rpcUrl, keypairAddress(deps.payerSecret))).filter((a) => !named.has(a));
  if (orphans.length > 0) {
    try {
      report.orphans = { addresses: orphans, signatures: await closePythUpdates({ rpcUrl: deps.rpcUrl, payerSecret: deps.payerSecret, addresses: orphans }) };
    } catch (error) {
      report.errors.push(`orphans: ${redactError(error)}`);
    }
  }
  return report;
}
