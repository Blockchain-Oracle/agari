import type { DeskViewWire } from "@/features/desk/protocol";
import { deskView, type DeskView, type HoldingRow } from "@/features/desk/view";

/**
 * web's `deskView` with one change for React Native's dev renderer: its props-diff (performance tracks) calls
 * JSON.stringify on arrays of primitives and throws on an array of bigints, wedging the screen. The price history
 * is only ever drawn, so it travels as display numbers; every money figure stays a bigint.
 */
export type NativeHolding = Omit<HoldingRow, "priceHistoryE8"> & { priceHistory: number[] };
export type NativeDeskView = Omit<DeskView, "holdings"> & { holdings: NativeHolding[] };

export function nativeDeskView(wire: DeskViewWire): NativeDeskView {
  const view = deskView(wire);
  return { ...view, holdings: view.holdings.map(({ priceHistoryE8, ...h }) => ({ ...h, priceHistory: priceHistoryE8.map((v) => Number(v)) })) };
}
