import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";

/**
 * The "tell me if it drops" bell (plan Step 8): an opt-in, device-local rule per stock the wallet holds — "tell me if
 * OpenAI falls 3% within an hour". The list of switched-on stocks lives in localStorage like the price alerts do; the
 * hour of prices it is judged against lives in the tab (`DropBellWatcher`), so the bell only watches while Agari is
 * open. Integer maths throughout: the drop is measured in basis points against the hour's high, never as a float.
 */
export const DROP_BELL_KEY = "agari.dropBell";
/** The rule's one size: a fall of 3% (300 bps) from the highest price of the trailing hour. */
export const DROP_BPS = 300n;
export const DROP_WINDOW_SEC = 3600;
const BPS = 10_000n;
const EMPTY: readonly TickerSymbol[] = [];

export interface PriceSample {
  sec: number;
  raw: bigint;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Fires after every local write, and on a `storage` event from another tab. */
export function subscribeDropBells(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DROP_BELL_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function parseBells(text: string | null): readonly TickerSymbol[] {
  try {
    const parsed: unknown = JSON.parse(text ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is TickerSymbol => typeof item === "string" && isTickerSymbol(item)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let cache: { text: string | null; list: readonly TickerSymbol[] } = { text: null, list: EMPTY };

/**
 * The stocks with the bell switched on. Stable while the stored text is unchanged, as `useSyncExternalStore` needs;
 * anything unreadable or unknown is dropped rather than watched wrongly.
 */
export function dropBellsSnapshot(): readonly TickerSymbol[] {
  if (typeof window === "undefined") return EMPTY;
  let text: string | null = null;
  try {
    text = localStorage.getItem(DROP_BELL_KEY);
  } catch {
    text = null;
  }
  if (text !== cache.text) cache = { text, list: parseBells(text) };
  return cache.list;
}

export const serverBells = (): readonly TickerSymbol[] => EMPTY;

export function setDropBell(asset: TickerSymbol, on: boolean): void {
  const current = dropBellsSnapshot().filter((item) => item !== asset);
  try {
    localStorage.setItem(DROP_BELL_KEY, JSON.stringify(on ? [...current, asset] : current));
  } catch {
    // storage refused: the toggle re-reads and shows the truth
  }
  emit();
}

/** The trailing hour of prices with the new sample appended; a sample older than the window falls off the front. */
export function keepHour(samples: readonly PriceSample[], sample: PriceSample): PriceSample[] {
  const cutoff = sample.sec - DROP_WINDOW_SEC;
  return [...samples.filter((s) => s.sec > cutoff), sample];
}

/** The hour's high, so the message can state the fact: "was $X, now $Y". */
export function hourHigh(samples: readonly PriceSample[]): PriceSample | null {
  let high: PriceSample | null = null;
  for (const s of samples) if (!high || s.raw > high.raw) high = s;
  return high;
}

/** How far the latest sample sits below the hour's high, in basis points (0 when it is the high). */
export function dropBps(samples: readonly PriceSample[]): bigint {
  const latest = samples.at(-1);
  const high = hourHigh(samples);
  if (!latest || !high || high.raw <= 0n) return 0n;
  return ((high.raw - latest.raw) * BPS) / high.raw;
}

/** Whole and tenth percent from basis points, in integer text ("3.4"). */
export function bpsToPctText(bps: bigint): string {
  const tenths = (bps + 5n) / 10n;
  return `${tenths / 10n}.${tenths % 10n}`;
}
