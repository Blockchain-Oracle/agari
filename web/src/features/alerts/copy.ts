/**
 * The price-alert control's words — ported from `reference/yosuku/components/PriceAlerts.tsx`.
 *
 * The reference never says where an alert fires, because in the pinned source it never
 * does: `checkAlerts` has no caller. Ours runs in the tab, so the foot line says so — and, for a
 * stock, when: a Regular-basis rule waits for the NYSE session.
 */
export const ALERTS = {
  button: "Alert",
  buttonLabel: (asset: string) => `Price alerts for ${asset}`,
  title: "Price Alerts",
  close: "Close",
  above: "Above",
  below: "Below",
  /** Which spot a rule watches (spec §1.5). The 24/7 token spot arrives with S6's token lane. */
  basis: {
    label: "Price basis",
    regular: "Regular",
    token: "24/7 token",
    tokenPending: "Arrives with the 24/7 token lane",
  },
  targetPlaceholder: "Target price",
  targetLabel: "Target price",
  add: "Add alert",
  remove: "Remove alert",
  /** Where an alert actually fires — a browser-side evaluator, so only while a tab is open. */
  foot: {
    on: "Fires while Agari is open in a tab",
    off: "Browser notifications are off — alerts show here as a toast while Agari is open",
    /** Outside the session a Regular rule is kept and not evaluated; `label` is the session chip's ("Opens Tue 09:30 ET"). */
    waiting: (label: string | null) => (label ? `Waiting for the open (${label})` : "Waiting for the open"),
  },
  /** The notification and toast when a target is crossed. */
  fired: {
    title: (asset: string, direction: "above" | "below", target: string) => `${asset} is ${direction} ${target}`,
    body: (priceText: string) => `Live price ${priceText}. Alert cleared.`,
  },
} as const;
