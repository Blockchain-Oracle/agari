import { getDeskChargeToPoolInstructionAsync, getDeskCreditFromPoolInstructionAsync, getDeskFundSlotInstructionAsync, getDeskMintInSlotInstructionAsync, getDeskSweepSlotToPoolInstructionAsync } from "@agari/clients/agari-private";
import { privateAuthFresh, type PrivateClaim, type PrivateOpenResult, type PrivateTicket } from "@agari/core/private";
import type { Address, MarketId, Side, Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getCollateral } from "../collateral";
import { readMarket, readSeries } from "../runtime/accounts";
import { signPrivateClaim } from "./claim";
import { keyBytes, kit, privateProgramId } from "./deployment";
import type { DeskClient } from "./desk-client";
import { isUnknownLanding, publicReason, refusalName, refusalWords } from "./desk-errors";
import { deriveSlotKeys } from "./keys";
import { readBudget, readCharged, readCredited, readDesk, readSlot, sizePrivateForStake } from "./reads";

export interface DeskOpenInput {
  owner: Address;
  marketId: MarketId;
  side: Side;
  stakeBase: bigint;
  minQuantityRaw: bigint;
  /** The owner's ed25519 signature over `privateOpenMessage` (base58). */
  authSignature: Signature;
  /** When the owner signed. A charge needs a fresh one; a resume of a charge that already landed does not. */
  issuedAtMs: number;
  asset: string;
  intervalSec: number;
  expirySec: number;
}

/** An open creates three accounts and sends three transactions; the desk key has to be able to pay for all of it before it starts. */
export const DESK_OPEN_LAMPORTS = 10_000_000n;

const config = () => ({ programAddress: kit(privateProgramId()) });

/**
 * The desk's open, as a state machine over chain state rather than a record: charge → fund → mint, each step skipped
 * when the chain already shows it landed. The three keys come from the owner's own authorisation signature, so a
 * request that lost its reply can simply be sent again, and a mint the book refuses is refunded to the private
 * balance on the spot, with the reason.
 */
export async function openPrivateBet(desk: DeskClient, input: DeskOpenInput): Promise<PrivateOpenResult> {
  const contract = await desk.contract();
  if (!contract) return { status: "unknown", reason: "There is no private desk on this network yet", txs: {} };
  const keys = await deriveSlotKeys(input.authSignature);
  const { owner, stakeBase } = input;
  const { decimals, symbol } = getCollateral();
  const amount = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const [chargeKey, creditKey, slotId] = [keyBytes(keys.chargeKey), keyBytes(keys.creditKey), keyBytes(keys.slotId)];
  const credit = async (amountBase: bigint) => desk.send("private refund credit", [await getDeskCreditFromPoolInstructionAsync({ desk: desk.signer, owner: kit(owner), amountBase, creditKey }, config())]);

  return desk.withSlotLock(keys.slotId, async () => {
    const txs: Partial<{ charge: Signature; fund: Signature; mint: Signature; sweep: Signature; credit: Signature }> = {};
    const refused = (reason: string, technical: string, refundedBase = 0n): PrivateOpenResult => ({ status: "refused", reason, technical, refundedBase: refundedBase.toString(), txs });
    try {
      let [charged, slot] = await Promise.all([readCharged(owner, keys.chargeKey), readSlot(keys.slotId)]);
      if (charged === 0n) {
        // Freshness gates only a NEW charge: an authorisation whose charge already landed is resumed however old it
        // is, because refusing it would strand the money it already moved.
        if (!privateAuthFresh(input.issuedAtMs, Date.now())) return refused("That authorisation has expired. Confirm again.", "auth expired");
        const [state, budget] = await Promise.all([readDesk(), readBudget(owner)]);
        if (state?.data.paused) return refused("Private mode is paused right now.", "Paused");
        if (budget.balanceBase < stakeBase) return refused(`Your private balance is ${amount(budget.balanceBase)}; this bet needs ${amount(stakeBase)}.`, "Insufficient");
        if (budget.allowanceBase < stakeBase) return refused(`Your private spending limit has ${amount(budget.allowanceBase)} left; this bet needs ${amount(stakeBase)}.`, "OverAllowance");
        // Before a unit moves: the book must be able to fill this at the owner's guard (a refused mint would cost the
        // desk four sends and the owner nothing), and the desk must be able to pay for the whole open.
        const preview = await sizePrivateForStake(input.marketId, input.side, stakeBase);
        if (!preview.ok) return refused(refusalWords(null).replace(" Your stake is back in your private balance.", " Nothing was charged."), publicReason(preview.error.technical));
        if (preview.value.quantityRaw < input.minQuantityRaw) return refused("The book moved under your quote. Nothing was charged. Quote again.", `quote ${preview.value.quantityRaw} < guard ${input.minQuantityRaw}`);
        const lamports = (await desk.client.rpc.getBalance(desk.signer.address).send()).value;
        if (lamports < DESK_OPEN_LAMPORTS) return refused("Private mode is short of fee money right now; nothing was charged.", "desk SOL below the open's envelope");

        txs.charge = (await desk.send("private charge", [await getDeskChargeToPoolInstructionAsync({ desk: desk.signer, owner: kit(owner), amountBase: stakeBase, chargeKey }, config())])) as Signature;
        charged = stakeBase;
      }
      if (slot.fundedAtSec === 0) {
        txs.fund = (await desk.send("private fund", [await getDeskFundSlotInstructionAsync({ desk: desk.signer, slotId, amountBase: charged }, config())])) as Signature;
      } else if (slot.mintedAtSec === 0 && slot.balanceBase === 0n) {
        // Funded once, then swept back: this authorisation was already refused. Finish the refund if its credit was
        // the send that got lost, or the stake would sit in the pool with no ticket to claim it.
        const owed = slot.sweptBase - (await readCredited(owner, keys.creditKey));
        if (owed > 0n) txs.credit = (await credit(owed)) as Signature;
        return refused("This bet was already refunded to your private balance.", "slot swept", slot.sweptBase);
      }
      if (slot.mintedAtSec === 0) {
        try {
          txs.mint = (await desk.send("private mint", [await mintInstruction(desk, input, slotId)])) as Signature;
        } catch (error) {
          if (isUnknownLanding(error)) throw error;
          // The book refused: the whole stake goes straight back, the reason with it.
          const name = refusalName(error);
          txs.sweep = (await desk.send("private refund sweep", [await getDeskSweepSlotToPoolInstructionAsync({ desk: desk.signer, slotId }, config())])) as Signature;
          txs.credit = (await credit(charged)) as Signature;
          return refused(refusalWords(name), publicReason(error instanceof Error ? error.message : String(error)), charged);
        }
      }

      slot = await readSlot(keys.slotId);
      const claim: PrivateClaim = { owner, slotId: keys.slotId, creditKey: keys.creditKey, marketId: input.marketId, outcomeIdx: input.side === "up" ? 0 : 1, stakeBase: charged.toString(), issuedAtMs: Date.now() };
      const ticket: PrivateTicket = {
        claim,
        signature: await signPrivateClaim(desk.signer, contract, desk.chainId, claim),
        desk: desk.address,
        contract,
        chainId: desk.chainId,
        asset: input.asset,
        intervalSec: input.intervalSec,
        expirySec: input.expirySec,
        quantityRaw: slot.quantityRaw.toString(),
        costBase: slot.costBase.toString(),
        txs: { charge: txs.charge ?? NO_TX, fund: txs.fund ?? NO_TX, mint: txs.mint ?? NO_TX },
        openedAtMs: claim.issuedAtMs,
        status: "open",
      };
      return { status: "opened", ticket };
    } catch (error) {
      if (isUnknownLanding(error)) return { status: "unknown", reason: "The chain has not answered yet. Try again in a moment. Nothing is charged twice.", txs };
      return { status: "unknown", reason: publicReason(error instanceof Error ? error.message : String(error)), txs };
    }
  });
}

/** A resumed open did not send every step itself; the ticket still needs a well-formed signature in each place. */
const NO_TX = "1111111111111111111111111111111111111111111111111111111111111111" as Signature;

async function mintInstruction(desk: DeskClient, input: DeskOpenInput, slotId: Uint8Array) {
  const market = await readMarket(input.marketId);
  if (!market) throw new Error(`Error Code: WindowNotTrading (Window not found: ${input.marketId})`);
  const state = await readDesk();
  if (!state) throw new Error("there is no private desk on this network");
  const { lotBase } = await readSeries(market.data.series);
  const { data } = market;
  return getDeskMintInSlotInstructionAsync({
    desk: desk.signer,
    series: kit(data.series as unknown as string),
    market: kit(input.marketId),
    book: kit(data.book as unknown as string),
    ledger: kit(data.ledger as unknown as string),
    mvault: kit(data.mvault as unknown as string),
    collateralMint: state.data.collateralMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    slotId,
    outcome: input.side === "up" ? 0 : 1,
    minLots: input.minQuantityRaw / lotBase,
  }, config());
}
