import { phase } from "@agari/core/lifecycle";
import { admissibilityBlocker } from "@agari/core/sizing";
import type { Address, DiagnosisKind, EventMarket, MarketId, Quote, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { actionRefusalOf, X_REFUSAL_DETAILS, type XRefusalCode } from "@agari/core/x";
import { compileTransaction, createNoopSigner, getBase64EncodedWireTransaction, type Address as KitAddress } from "@solana/kit";
import { failureDiagnosis } from "../submitter/chain-failure";
import { OrderRefusedError, RequoteError, SimulationFailedError } from "../submitter/errors";
import { diagnose } from "../errors/error-map";
import { getMarket } from "../provider/markets";
import { getOnchain } from "../provider/onchain";
import { nowMs } from "../provider/clock";
import { readSeat, readSeries } from "../runtime/accounts";
import { solana } from "../runtime/solana";
import { assertFunded } from "../submitter/funding";
import { buildOrder } from "../submitter/steps/build";
import { orderExpiry } from "../submitter/steps/expiry";
import { readFreshQuote } from "../submitter/steps/quote";

/**
 * A Window as an unsigned transaction, for the Blinks endpoint (S11).
 *
 * The blink client holds the viewer's wallet, not us: it sends an address and signs whatever comes back. So this
 * runs the order lane's read half — status, fresh quote, admissibility, funding, expiry — and stops at `buildOrder`,
 * which simulates and compute-limits exactly as the app's own lane does. `createNoopSigner` supplies the authority
 * slot without a key; `buildWrite` simulates with `sigVerify: false`, so an unsigned message still proves it would
 * land. Nothing here signs, sends or journals: the viewer's wallet owns all three.
 *
 * Every refusal is a public `XRefusalCode`, so a Blink card, an X reply and the app say the same words.
 */
export type ActionOrderResult =
  | { ok: true; transaction: string; message: string }
  | { ok: false; code: XRefusalCode; message: string };

const refuse = (code: XRefusalCode): ActionOrderResult => ({ ok: false, code, message: X_REFUSAL_DETAILS[code] });

/**
 * Every way the read half can end, as one of the public codes. The order lane signals refusals by throwing
 * (`OrderRefusedError`, `SimulationFailedError`, `RequoteError`), and a Blink client renders whatever we hand it to
 * a stranger — so nothing may escape as a 500 or as a provider diagnostic. This is `notSentOutcome`'s job, told in
 * the X vocabulary instead of the app's.
 */
const PUBLIC_CODE: Partial<Record<DiagnosisKind, XRefusalCode>> = {
  "insufficient-collateral": "insufficient-funds",
  "out-of-gas": "insufficient-funds",
  "market-not-trading": "window-entry-closed",
  "order-expired": "window-entry-closed",
  "pre-open-taker": "window-entry-closed",
  "no-liquidity": "no-liquidity",
  "thin-book": "no-liquidity",
  "post-only-would-cross": "no-liquidity",
  "too-many-resting": "position-limit",
  "reserve-cap": "no-liquidity",
  "below-min-quantity": "instruction-invalid",
  "outside-band": "price-limit",
  "invalid-price": "price-limit",
  requote: "price-moved",
  "daily-stop": "execution-paused",
  "not-deployed": "not-deployed",
  "indexer-down": "market-data-unavailable",
  "rpc-down": "market-data-unavailable",
  /** An engine code with no public wording of its own (6119 self-match, say): say the venue refused, not why. */
  "contract-revert": "execution-unavailable",
};

function refusalOf(error: unknown): ActionOrderResult {
  if (error instanceof RequoteError) return refuse("price-moved");
  const diagnosis = error instanceof OrderRefusedError ? error.diagnosis
    : error instanceof SimulationFailedError ? failureDiagnosis(error.failure)
    : diagnose(error);
  const code = PUBLIC_CODE[diagnosis.kind];
  // The technical half stays on the server, as every funded surface does: a Blink is read by strangers. An engine
  // revert and an unmapped kind are both "the venue said no in words we do not publish", so both are logged.
  if (!code || diagnosis.kind === "contract-revert") console.error("blink action refused:", diagnosis.kind, "|", diagnosis.technical);
  return refuse(code ?? "execution-unavailable");
}

export interface ActionOrderInput {
  marketId: MarketId;
  wallet: Address;
  side: Side;
  stakeBase: bigint;
}

/**
 * What the wallet shows above the signature: the call, its price, the worst case, and — when the book is thinner than
 * the amount asked for — that the order fills only part of it. The Ticket says this before anyone signs
 * (`copy-ticket.ts`), so a Blink says it too: it is the one surface where the person has never seen the app.
 */
function signingMessage(market: EventMarket, side: Side, quote: Quote): string {
  const d = market.decimals;
  const head = `${side === "up" ? "Up" : "Down"} on ${market.asset} at ${quote.oddsCents}¢. `
    + `Risk ${formatBaseUnits(quote.maxCostBase, d)} tUSDC to win ${formatBaseUnits(quote.payoutIfRightBase, d)} tUSDC.`;
  if (!quote.partial) return head;
  return `${head} Fills up to ${formatBaseUnits(quote.fillableStakeBase, d)} tUSDC at this size — the rest stays in your wallet.`;
}

/** The guard every caller gets: a refusal, never a throw. A blink client shows this text to a stranger. */
export async function buildWindowActionTransaction(input: ActionOrderInput): Promise<ActionOrderResult> {
  try {
    return await readAndBuild(input);
  } catch (error) {
    return refusalOf(error);
  }
}

async function readAndBuild(input: ActionOrderInput): Promise<ActionOrderResult> {
  const reading = await getMarket(input.marketId);
  if (!reading.ok) return refuse("market-data-unavailable");
  const market = reading.value;
  if (!market) return refuse("no-window");

  const at = nowMs();
  const closed = actionRefusalOf(phase(market, at));
  if (closed) return refuse(closed);

  const series = await readSeries(market.seriesAddress);
  const quote = await readFreshQuote({ market, series, side: input.side, stakeBase: input.stakeBase }, at).catch(() => null);
  if (!quote) return refuse("no-liquidity");
  if (admissibilityBlocker(quote.avgPriceBps)) return refuse("price-limit");

  const onchain = await getOnchain(input.marketId);
  if (!onchain.ok) return refuse("market-data-unavailable");
  const funded = await assertFunded(input.wallet, onchain.value, quote);
  if (!funded.ok) return refuse(funded.diagnosis.kind === "insufficient-collateral" ? "insufficient-funds" : "quote-unavailable");

  const seatRead = await readSeat(onchain.value.ledger, input.wallet);
  const built = await buildOrder(solana().rpc, {
    signer: createNoopSigner(input.wallet as string as KitAddress),
    market,
    ledger: onchain.value.ledger,
    series,
    side: input.side,
    quote,
    expireTs: orderExpiry(at, market),
    seatIndex: seatRead?.seat?.index ?? null,
  });
  return { ok: true, transaction: getBase64EncodedWireTransaction(compileTransaction(built.message)), message: signingMessage(market, input.side, quote) };
}
