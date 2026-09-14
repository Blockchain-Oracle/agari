// Sweep, then redeem every drive user and check each payout to the base unit against the seat it held.

import { readSeats, redeem, sweepExpired, type OpenedWindow } from "@agari/markets/deploy";
import type { DriveEnv } from "./events-cycle";

type User = [signer: Parameters<typeof redeem>[2], token: string];

const PAYOUT_DENOMINATOR = 10_000_000n;
const SEAT_FLAG_BONDED = 2;
const STATE = ["open", "resolved", "voided"];
const VOID_REASON = ["none", "missing print", "cross-check divergence"];

export async function redeemAll(env: DriveEnv, w: OpenedWindow, users: User[], label: string) {
  const { client, ctx } = env;
  const tokenAmount = async (address: string) => (await client.token.accounts.token.fetch(address as never)).data.amount;
  const market = (await client.agariEvents.accounts.market.fetch(w.market)).data;
  const cashUnit = (await client.agariEvents.accounts.series.fetch(w.series)).data.cashUnit;
  const seatBond = (await client.agariEvents.accounts.ledger.fetch(w.ledger)).data.seatBond;
  const price = (p: { price: bigint; signers: number; source: number }) => (p.source === 0 ? "—" : `${p.price}e-8 (src ${p.source}, ${p.signers} signers)`);
  console.log(
    `  ${label} ${STATE[market.state]} (${VOID_REASON[market.voidReason]}), payout yes ${market.payoutYes} / no ${market.payoutNo}` +
      `\n    open ${price(market.open)} · close ${price(market.close)} · check open ${price(market.checkOpen)} · check close ${price(market.checkClose)}`,
  );
  if (market.state === 0) throw new Error(`${label} is not terminal`);

  await sweepExpired(ctx, w);
  const seats = await readSeats(client, w.ledger);
  let paid = 0n;
  const vaultBefore = await tokenAmount(w.mvault);
  for (const [user, token] of users) {
    const seat = seats.find((s) => s.owner === user.address);
    if (!seat) throw new Error(`${label}: ${user.address} has no seat`);
    const lots = (seat.yesFree + seat.yesLocked) * 1000n * cashUnit * BigInt(market.payoutYes) + (seat.noFree + seat.noLocked) * 1000n * cashUnit * BigInt(market.payoutNo);
    const expected = seat.credit + seat.lockedCash + lots / PAYOUT_DENOMINATOR + ((seat.flags & SEAT_FLAG_BONDED) !== 0 ? seatBond : 0n);
    const before = await tokenAmount(token);
    await redeem(ctx, w, user, token as never, seat.index);
    const got = (await tokenAmount(token)) - before;
    if (got !== expected) throw new Error(`${label} seat ${seat.index}: paid ${got}, expected ${expected}`);
    paid += got;
    console.log(`    seat ${seat.index} ${user.address.slice(0, 6)}: paid ${got} = expected ✓`);
  }
  const vaultAfter = await tokenAmount(w.mvault);
  if (vaultBefore - vaultAfter !== paid) throw new Error(`${label}: mvault moved ${vaultBefore - vaultAfter}, paid ${paid}`);
  console.log(`    mvault ${vaultBefore} → ${vaultAfter} (paid ${paid}) ✓`);
}
