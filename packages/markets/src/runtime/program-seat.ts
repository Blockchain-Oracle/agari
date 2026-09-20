import { diagnosis, type Address, type MarketId } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { readSeat } from "./accounts";

/** `product:market` pairs whose Ledger is known to carry the product's seat. A seat does not leave a live Window, so one look is enough. */
const seated = new Set<string>();

/**
 * The engine seats every registered program when it opens a Window, so a Window older than a product's registration
 * has no seat for it and the product's trade there refuses (`WindowPredatesReserve`, `WindowPredatesDesk`). A quote
 * says so before anyone signs, instead of letting the chain say it after.
 */
export async function requireProgramSeat(product: string, marketId: MarketId, ledger: Address, seat: Address): Promise<void> {
  const key = `${product}:${marketId}`;
  if (seated.has(key)) return;
  const found = await readSeat(ledger, seat);
  if (!found?.seat) throw new ReadingError(diagnosis("market-not-trading", `this Window opened before ${product} was seated; the next one works`));
  seated.add(key);
}
