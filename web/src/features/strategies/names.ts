/** Deterministic identity marks from an address, ported from `lib/sui/strategyClient.ts` — texture, not a label. The face itself is drawn in AgentPortrait.tsx. */
const NAME_FIRST = ["Kai", "Mara", "Devin", "Yuki", "Rosa", "Theo", "Nadia", "Owen", "Lena", "Arun", "Mika", "Cole", "Sana", "Bruno", "Ivy", "Rey", "Hana", "Milo", "Zara", "Finn", "Noor", "Dario", "Elle", "Kenji"];
const NAME_LAST = ["Ryder", "Vance", "Okafor", "Tanaka", "Mercer", "Duval", "Sato", "Brooks", "Novak", "Reyes", "Holt", "Ansari", "Frost", "Kang", "Beck", "Costa", "Wray", "Ito", "Nash", "Ozturk", "Vega", "Lund", "Hale", "Mori"];
/** Eight curated accents live in `strategies.css` as `.strat-accent-N`; the index is the only thing computed here. */
export const ACCENT_COUNT = 8;

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return h;
}

/** A person to remember instead of a bare 0x… address; stable per seed. */
export function codenameFromAddress(seed: string): string {
  const h = hashOf(seed);
  return `${NAME_FIRST[Math.abs(h) % NAME_FIRST.length]} ${NAME_LAST[Math.abs(h >> 5) % NAME_LAST.length]}`;
}

export function accentIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % ACCENT_COUNT;
}

export const shortAddress = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** `ago` ported: "no trades yet" for never, else s/m/h/d. */
export function ago(thenMs: number, nowMs: number): string {
  if (!thenMs) return "no trades yet";
  const s = Math.floor((nowMs - thenMs) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
