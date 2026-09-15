import type { SocialFillRow, SocialSettlementRow } from "@agari/db";
import { expect, it } from "vitest";
import { fillItem, settlementFacts, settlementItems } from "./items";

const fill = (over: Partial<SocialFillRow>): SocialFillRow => ({
  signature: "3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg",
  outer_ix: 0,
  inner_ix: 0,
  fill_ix: 0,
  market: "4SCCa1z6oYARC8BNPHsuCaaTdycuN6wuYGADgeBBMgki",
  wallet: "DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP",
  kind: 0,
  seat: "taker",
  symbol: "TSLA",
  cadence_sec: 300,
  lots: "1000",
  amount_base: "550000",
  ts_sec: "1789397131",
  ...over,
});

it("reads a fill from the taker's seat as a call and from the maker's seat as a resting call that filled (D-088)", () => {
  expect(fillItem(fill({}))).toMatchObject({ kind: "fill", side: "up", lots: "1000", amountBase: "550000" });
  expect(fillItem(fill({ seat: "maker", kind: 2 }))).toMatchObject({ kind: "resting-filled", side: "down" });
  expect(fillItem(fill({ seat: "maker" })).id).toBe(fillItem(fill({})).id);
});

/** The two drive wallets' seats on devnet TSLA 5m Window 4SCCa1z6… (S2 drive, 2026-09-14), as the index holds them. */
const seat = (over: Partial<SocialSettlementRow>): SocialSettlementRow => ({
  market: "4SCCa1z6oYARC8BNPHsuCaaTdycuN6wuYGADgeBBMgki",
  owner: "DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP",
  symbol: "TSLA",
  cadence_sec: 300,
  state: "resolved",
  winner: 0,
  resolved_ts_sec: "1789397131",
  expiry_sec: "1789397100",
  held_yes_lots: "2000",
  held_no_lots: "0",
  lot_base: "1000",
  cost_base: "2480000",
  proceeds_base: "1400000",
  redeemed: true,
  redeemed_by_crank: false,
  payout_base: "2000000",
  last_signature: "3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg",
  last_ts_sec: "1789397143",
  ...over,
});

it("pays the held Up leg on an Up win and nets the round's cash", () => {
  const facts = settlementFacts(seat({}));
  expect(facts.payoutBase).toBe(2_000_000n);
  expect(facts.pnlBase).toBe(920_000n);
  expect(facts.verdict).toBe("settled-win");
});

it("calls a hedged seat that was paid but lost money a loss", () => {
  const hedged = seat({ owner: "5jVoTHRN6uydxNEbxXDvNm5gbkyV5Y7oypgRureA3wjU", held_yes_lots: "1000", held_no_lots: "3000", cost_base: "2220000", proceeds_base: "300000", payout_base: "1000000" });
  const facts = settlementFacts(hedged);
  expect(facts.payoutBase).toBe(1_000_000n);
  expect(facts.pnlBase).toBe(-920_000n);
  expect(facts.verdict).toBe("settled-loss");
  expect(settlementItems(hedged, { payouts: true }).map((i) => [i.kind, i.amountBase, i.side])).toEqual([["settled-loss", "-920000", "down"]]);
});

it("gives no verdict to a seat that sold out before expiry", () => {
  expect(settlementItems(seat({ held_yes_lots: "0", payout_base: "0" }), { payouts: true })).toEqual([]);
});

it("refunds half of each held leg on a void, and says it is still claimable until redeemed", () => {
  const voided = seat({ state: "voided", winner: 2, held_yes_lots: "1001", held_no_lots: "3", redeemed: false, payout_base: "0" });
  const items = settlementItems(voided, { payouts: true });
  expect(items.map((i) => [i.kind, i.amountBase])).toEqual([
    ["voided", "502000"],
    ["claimable", "502000"],
  ]);
});

it("reports the settler's crank payout with the crank's signature and time", () => {
  const crank = seat({ redeemed_by_crank: true, last_ts_sec: "1789397431" });
  const paid = settlementItems(crank, { payouts: true }).find((i) => i.kind === "paid-automatically");
  expect(paid).toMatchObject({ amountBase: "2000000", signature: crank.last_signature, atSec: 1789397431 });
  expect(settlementItems(crank, { payouts: false }).map((i) => i.kind)).toEqual(["settled-win"]);
});
