/** Turns one settler action into a transaction (or a DRY line), and maps engine codes to "look again when". */
import {
  closeLedgerInstruction,
  closeMarketInstruction,
  readResultRentPayer,
  redeemForInstructions,
  releaseBookInstruction,
  settleInstruction,
  sweepInstruction,
  voidInstruction,
  type LedgerState,
  type VenueConfig,
} from "@agari/markets/ops/settle";
import { ENGINE_ERROR, OpsSendError, sendOps, type MarketView, type OpsClient } from "@agari/markets/ops";
import type { SettleAction } from "./decide";

export type Outcome = { sent: string | null; nextCheckSec: number; note: string; done?: boolean };

type Sendable = Exclude<SettleAction, { kind: "wait" } | { kind: "read" }>;

async function instructionsFor(client: OpsClient, action: Sendable, m: MarketView, config: VenueConfig, ledger: LedgerState | null | undefined) {
  switch (action.kind) {
    case "settle":
      return [await settleInstruction(client, m)];
    case "void":
      return [await voidInstruction(client, m)];
    case "sweep":
      return [await sweepInstruction(m)];
    case "releaseBook":
      return [await releaseBookInstruction(m)];
    case "redeemFor": {
      const owners = new Map((ledger?.seats ?? []).map((s) => [s.index, s.owner]));
      const lists = await Promise.all(action.seats.map((index) => redeemForInstructions(client, m, config, { index, owner: owners.get(index)! })));
      return lists.flat();
    }
    case "closeLedger":
      if (!ledger) throw new Error("close ledger without a ledger read");
      return [await closeLedgerInstruction(m, config, ledger.rentPayer)];
    case "closeMarket": {
      const result = await readResultRentPayer(client, m.address);
      if (!result) throw new Error("close market without a MarketResult");
      return [await closeMarketInstruction(m, config, result)];
    }
  }
}

/** Engine codes that mean "someone got there first" or "not yet": when to look again (chain seconds). */
function afterCode(code: number | null, action: Sendable, nowSec: number, m: MarketView, checkAdmissionSec: number): Outcome | null {
  const again = (sec: number, note: string, done = false): Outcome => ({ sent: null, nextCheckSec: sec, note, done });
  switch (code) {
    case ENGINE_ERROR.crossCheckPending:
      return again(Number(m.data.expiry) + checkAdmissionSec + 1, "cross-check pending");
    case ENGINE_ERROR.marketAlreadyTerminal:
      return again(nowSec, "already resolved");
    case ENGINE_ERROR.settlementWindowOpen:
    case ENGINE_ERROR.marketNotTerminal:
    case ENGINE_ERROR.openOrdersRemain:
    case ENGINE_ERROR.ledgerNotEmpty:
    case ENGINE_ERROR.printsMissing:
      return again(nowSec + 10, "state moved; re-reading");
    case ENGINE_ERROR.bookMarketMismatch:
      return action.kind === "releaseBook" ? again(nowSec, "book already released") : null;
    case ENGINE_ERROR.retentionNotElapsed:
    case ENGINE_ERROR.dependentsRemain:
      return again(nowSec + 60, "not closable yet");
    default:
      return null;
  }
}

export async function execute(
  input: { client: OpsClient; dryRun: boolean; nowSec: number; config: VenueConfig; checkAdmissionSec: number; label: string },
  action: Sendable,
  m: MarketView,
  ledger: LedgerState | null | undefined,
): Promise<Outcome> {
  const name = action.kind === "redeemFor" ? `redeem_for seats ${action.seats.join(",")}` : action.kind;
  if (input.dryRun) return { sent: null, nextCheckSec: input.nowSec + 30, note: `DRY ${name} ${input.label}: ${action.why}` };
  try {
    const instructions = await instructionsFor(input.client, action, m, input.config, ledger);
    const { signature } = await sendOps(input.client, instructions, `${name} ${input.label}`);
    return { sent: signature, nextCheckSec: input.nowSec, note: `${name} ${input.label}: ${action.why} · ${signature}` };
  } catch (error) {
    const code = error instanceof OpsSendError ? error.code : null;
    const handled = afterCode(code, action, input.nowSec, m, input.checkAdmissionSec);
    if (handled) return { ...handled, note: `${name} ${input.label}: ${handled.note} (engine ${code})` };
    throw error;
  }
}
