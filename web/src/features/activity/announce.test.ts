import { expect, it } from "vitest";
import { LATE_SEC, selectAnnouncements, type WatchState } from "./announce";
import type { ActivityItem } from "./protocol";

const MOUNT = 1_789_450_000;
const item = (id: string, kind: ActivityItem["kind"], atSec: number, over: Partial<ActivityItem> = {}): ActivityItem => ({
  id,
  kind,
  wallet: "DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP" as ActivityItem["wallet"],
  marketId: "4SCCa1z6oYARC8BNPHsuCaaTdycuN6wuYGADgeBBMgki" as ActivityItem["marketId"],
  asset: "TSLA",
  intervalSec: 300,
  side: "up",
  lots: "1000",
  amountBase: "2000000",
  signature: null,
  takeId: null,
  atSec,
  ...over,
});
const fresh = (): WatchState => ({ mountSec: MOUNT, baselined: false, seen: new Set() });
const none = new Set<string>();

it("announces nothing already in the inbox at mount, then only what is new", () => {
  const state = fresh();
  const old = item("fill:a", "fill", MOUNT - 30);
  expect(selectAnnouncements([old], state, none, none).announce).toEqual([]);
  const next = item("settled:m:w", "settled-loss", MOUNT + 40);
  expect(selectAnnouncements([next, old], state, none, none).announce.map((a) => a.item.id)).toEqual(["settled:m:w"]);
  expect(selectAnnouncements([next, old], state, none, none).announce).toEqual([]);
});

it("still announces an event the index recorded after the first answer, if it is recent", () => {
  const state = fresh();
  selectAnnouncements([], state, none, none);
  const late = item("fill:late", "fill", MOUNT - 10);
  const stale = item("fill:stale", "fill", MOUNT - LATE_SEC - 1);
  expect(selectAnnouncements([late, stale], state, none, none).announce.map((a) => a.item.id)).toEqual(["fill:late"]);
});

it("skips this tab's own fills, takes, and what another tab already announced", () => {
  const state = fresh();
  selectAnnouncements([], state, none, none);
  const own = item("fill:own", "fill", MOUNT + 5, { signature: "sigOwn" });
  const take = item("take:1", "take", MOUNT + 6);
  const other = item("paid:m:w", "paid-automatically", MOUNT + 7);
  const result = selectAnnouncements([own, take, other], state, new Set(["paid:m:w"]), new Set(["sigOwn"]));
  expect(result.announce).toEqual([]);
});

it("folds a claimable win into one notification that covers both ids", () => {
  const state = fresh();
  selectAnnouncements([], state, none, none);
  const win = item("settled:m:w", "settled-win", MOUNT + 60, { amountBase: "920000" });
  const claim = item("claimable:m:w", "claimable", MOUNT + 60, { amountBase: "2000000" });
  const { announce } = selectAnnouncements([claim, win], state, none, none);
  expect(announce).toEqual([{ item: win, claimBase: "2000000", ids: ["settled:m:w", "claimable:m:w"] }]);
});
