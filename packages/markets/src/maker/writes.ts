import {
  findCustodyPda, findSeatPda, findVaultPda,
  getMakerPullInstructionAsync, getProviderSupplyInstructionAsync, getProviderWithdrawInstructionAsync,
  getPublicMergeInstructionAsync, getPublicSettleInstructionAsync,
} from "@agari/clients/agari-maker";
import { AGARI_EVENTS_PROGRAM_ADDRESS, findConfigPda, findLedgerPda, findMvaultPda } from "@agari/clients/agari-events";
import type { MakerIntent } from "@agari/core/maker";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis } from "@agari/core/types";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getProgramDerivedAddress, type Address as KitAddress, type Instruction } from "@solana/kit";
import { OrderRefusedError } from "../submitter/errors";
import type { WriteContext } from "../submitter/settle-write";
import { submitLaneWrite } from "../submitter/lane-write";
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
export function submitMakerTx(ctx: WriteContext, intent: MakerIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return submitLaneWrite(ctx, intent.kind, () => instructionFor(ctx, intent), onPhase);
}
