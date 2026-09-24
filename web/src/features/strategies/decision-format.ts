/** The average price of a fill in cents per share: what it cost over the shares it bought, both in collateral units. */
export function fillPriceCents(cashDeltaBase: string, tokenDeltaRaw: string): number | null {
  const cash = BigInt(cashDeltaBase);
  const tokens = BigInt(tokenDeltaRaw);
  if (tokens <= 0n || cash < 0n) return null;
  // Tenths of a cent, then one decimal: 2.17 for 5 shares is 43.4¢.
  return Number((cash * 1000n) / tokens) / 10;
}

/** A Window's span as local clock times, with the day when it is not today. */
export function windowSpan(startSec: number, expirySec: number, nowMs: number): string {
  const time = (sec: number) => new Date(sec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const start = new Date(startSec * 1000);
  const sameDay = start.toDateString() === new Date(nowMs).toDateString();
  const day = sameDay ? "" : `${start.toLocaleDateString([], { month: "short", day: "numeric" })}, `;
  return `${day}${time(startSec)}–${time(expirySec)}`;
}

/** A moment as a local date and time, to the second. */
export function when(ms: number): string {
  return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
