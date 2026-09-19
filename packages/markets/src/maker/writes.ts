import {
  findCustodyPda, findSeatPda, findVaultPda,
  getMakerPullInstructionAsync, getProviderSupplyInstructionAsync, getProviderWithdrawInstructionAsync,
  getPublicMergeInstructionAsync, getPublicSettleInstructionAsync,
} from "@agari/clients/agari-maker";
import { AGARI_EVENTS_PROGRAM_ADDRESS, findConfigPda, findLedgerPda, findMvaultPda } from "@agari/clients/agari-events";
import type { MakerIntent } from "@agari/core/maker";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Signature } from "@agari/core/types";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getProgramDerivedAddress, type Address as KitAddress, type Instruction } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { failureDiagnosis } from "../submitter/chain-failure";
import { OrderRefusedError, SimulationFailedError } from "../submitter/errors";
import { signSendConfirm, type WriteContext } from "../submitter/settle-write";
import { buildWrite } from "../submitter/steps/message";
import { readMarket, readSeat } from "../runtime/accounts";

const minOf = (a: bigint, b: bigint) => (a < b ? a : b);
import { solana } from "../runtime/solana";
import { makerProgramId, windowBookAddress } from "./reads";

const kit = (value: string) => value as KitAddress;

/** Every maker CPI needs the same engine accounts for one Window; they are derived from the Market itself. */
async function windowAccounts(marketId: string) {
  const market = await readMarket(kit(marketId));
  if (!market) throw new OrderRefusedError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
  const [[ledger], [mvault], [eventsConfig], [eventAuthority]] = await Promise.all([
    findLedgerPda({ market: kit(marketId) }),
    findMvaultPda({ market: kit(marketId) }),
    findConfigPda(),
    getProgramDerivedAddress({ programAddress: AGARI_EVENTS_PROGRAM_ADDRESS, seeds: ["__event_authority"] }),
  ]);
  return {
    market: kit(marketId),
    series: market.data.series as unknown as KitAddress,
    venueBook: market.data.book as unknown as KitAddress,
    ledger, mvault, eventsConfig, eventAuthority,
    lockAt: market.data.lockAt,
  };
}

async function instructionFor(ctx: WriteContext, intent: MakerIntent): Promise<Instruction> {
  const program = kit(makerProgramId());
  const [[vault], [custody], [seat]] = await Promise.all([
    findVaultPda({ programAddress: program }),
    findCustodyPda({ programAddress: program }),
    findSeatPda({ programAddress: program }),
  ]);

  if (intent.kind === "maker-supply" || intent.kind === "maker-withdraw") {
    const venue = await findConfigPda();
    const config = await solana().rpc.getAccountInfo(venue[0], { encoding: "base64" }).send();
    if (!config.value) throw new OrderRefusedError(diagnosis("not-deployed", "no venue config on this cluster"));
    // The vault records its collateral at init; the provider's token account is that mint's ATA.
    const { fetchMakerVault } = await import("@agari/clients/agari-maker");
    const account = await fetchMakerVault(solana().rpc, (await findVaultPda({ programAddress: program }))[0]);
    const [providerToken] = await findAssociatedTokenPda({
      owner: kit(ctx.wallet), mint: account.data.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const shared = {
      provider: ctx.signer, custody, seat, providerToken,
      collateralMint: account.data.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    };
    return intent.kind === "maker-supply"
      ? getProviderSupplyInstructionAsync({ ...shared, amountBase: intent.amountBase })
      : getProviderWithdrawInstructionAsync({ ...shared, shares: intent.shares });
  }

  const { fetchMakerVault } = await import("@agari/clients/agari-maker");
  const vaultAccount = await fetchMakerVault(solana().rpc, vault);
  const w = await windowAccounts(intent.marketId);
  const bookRecord = kit(await windowBookAddress(intent.marketId));
  const engine = {
    bookRecord, custody, seat,
    eventsProgram: AGARI_EVENTS_PROGRAM_ADDRESS,
    eventsConfig: w.eventsConfig,
    series: w.series, market: w.market, ledger: w.ledger, mvault: w.mvault,
    collateralMint: vaultAccount.data.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    eventsEventAuthority: w.eventAuthority,
  };
  if (intent.kind === "maker-pull") return getMakerPullInstructionAsync({ ...engine, caller: ctx.signer, venueBook: w.venueBook });
  if (intent.kind === "maker-merge") {
    // The engine merges an exact number of sets, so the mergeable amount is read rather than guessed: a complete
    // set is one YES and one NO, and the vault can only unmake as many as it holds of the scarcer side.
    const held = await readSeat(w.ledger, seat);
    const lots = held?.seat ? minOf(held.seat.yesFree, held.seat.noFree) : 0n;
    if (lots === 0n) throw new OrderRefusedError(diagnosis("below-min-quantity", "the vault holds no complete set on this Window"));
    return getPublicMergeInstructionAsync({ ...engine, cranker: ctx.signer, lots });
  }
  if (intent.kind === "maker-settle") return getPublicSettleInstructionAsync({ ...engine, cranker: ctx.signer });
  throw new OrderRefusedError(diagnosis("not-deployed", `${intent.kind} is the maker actor's, not a wallet's`));
}

/**
 * Every maker write a wallet can make: supply, withdraw, pull, merge and settle.
 *
 * `maker-quote` is deliberately absent. Quoting is the designated maker actor's, enforced on chain, and a wallet
 * sending one would only ever be refused — better to say so here than to build a transaction that cannot land.
 */
export async function submitMakerTx(ctx: WriteContext, intent: MakerIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  try {
    const instruction = await instructionFor(ctx, intent);
    const built = await buildWrite(ctx.rpc, ctx.signer, [instruction]);
    const record = await ctx.journal.record({ kind: intent.kind, wallet: ctx.wallet, summary: intent.kind });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);
    if (settled.kind === "not-sent") return refusalOf(settled.error);
    const txHash = settled.signature as Signature;
    if (settled.kind === "unknown") {
      return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason})`, { txHash }), txHash };
    }
    if (settled.kind === "landed-failed") {
      const diag = failureDiagnosis(settled.failure);
      await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
      return { status: "reverted", diagnosis: diagnosis(diag.kind, diag.technical, { txHash }), txHash };
    }
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash });
    return { status: "confirmed", txHash };
  } catch (error) {
    return refusalOf(error);
  }
}

function refusalOf(error: unknown): TxOutcome {
  if (error instanceof OrderRefusedError) return { status: "refused", diagnosis: error.diagnosis };
  if (error instanceof SimulationFailedError) return { status: "refused", diagnosis: failureDiagnosis(error.failure) };
  return { status: "refused", diagnosis: diagnose(error) };
}
