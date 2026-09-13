/**
 * The price-alert control's words — ported from `reference/yosuku/components/PriceAlerts.tsx`.
 *
 * The reference never says where an alert fires, because in the pinned source it never
 * does: `checkAlerts` has no caller. Ours runs in the tab, so the foot line says so.
 */
export const ALERTS = {
  button: "Alert",
  buttonLabel: (asset: string) => `Price alerts for ${asset}`,
  title: "Price Alerts",
  close: "Close",
  above: "Above",
  below: "Below",
  targetPlaceholder: "Target price",
  targetLabel: "Target price",
  add: "Add alert",
  remove: "Remove alert",
  /** Where an alert actually fires — a browser-side evaluator, so only while a tab is open. */
  foot: {
    on: "Fires while Masayume is open in a tab",
    off: "Browser notifications are off — alerts show here as a toast while Masayume is open",
  },
  /** The notification and toast when a target is crossed. */
  fired: {
    title: (asset: string, direction: "above" | "below", target: string) => `${asset} is ${direction} ${target}`,
    body: (priceText: string) => `Live price ${priceText}. Alert cleared.`,
  },
} as const;
