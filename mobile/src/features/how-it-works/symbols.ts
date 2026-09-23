import type { AndroidSymbol, SFSymbol } from "expo-symbols";

export type Glyph = { ios: SFSymbol; android: AndroidSymbol };

const g = (ios: SFSymbol, android: AndroidSymbol): Glyph => ({ ios, android });

/**
 * web content.ts / sessions.ts carry lucide icons beside their words; the phone draws the same meaning in SF Symbols
 * and Material Symbols, keyed by the lucide name each item uses there.
 */
export const GLYPH = {
  coins: g("dollarsign.circle.fill", "paid"),
  target: g("scope", "target"),
  zap: g("bolt.fill", "bolt"),
  trophy: g("trophy.fill", "emoji_events"),
  trendingUp: g("chart.line.uptrend.xyaxis", "trending_up"),
  clock: g("clock.fill", "schedule"),
  shield: g("checkmark.shield.fill", "shield"),
  eyeOff: g("eye.slash.fill", "visibility_off"),
  lock: g("lock.fill", "lock"),
  calendarClock: g("calendar.badge.clock", "event_upcoming"),
  moon: g("moon.fill", "dark_mode"),
  octagonAlert: g("exclamationmark.octagon.fill", "report"),
  scale: g("scalemass.fill", "balance"),
  wallet: g("wallet.bifold.fill", "account_balance_wallet"),
  layers: g("square.3.layers.3d", "layers"),
  listChecks: g("checklist", "checklist"),
  help: g("questionmark.circle.fill", "help"),
  chevronDown: g("chevron.down", "expand_more"),
  arrowRight: g("arrow.right", "arrow_forward"),
} as const;

/** content.ts STEPS, by number: Coins, Target, Zap, Trophy. */
export const STEP_GLYPHS: Record<number, Glyph> = { 1: GLYPH.coins, 2: GLYPH.target, 3: GLYPH.zap, 4: GLYPH.trophy };

/** content.ts MECHANICS, by title. */
export const MECHANIC_GLYPHS: Record<string, Glyph> = {
  "Order-Book Pricing": GLYPH.coins,
  "Live Price": GLYPH.trendingUp,
  "Fast Rounds": GLYPH.clock,
  "On-Chain Settlement": GLYPH.shield,
};

/** content.ts ARCHITECTURE, by title. */
export const ARCH_GLYPHS: Record<string, Glyph> = {
  "Transparent Positions": GLYPH.eyeOff,
  "Instant Finality": GLYPH.lock,
  "Program Settlement": GLYPH.shield,
};

/** sessions.ts LANES and ASIDES, by name. */
export const LANE_GLYPHS: Record<string, Glyph> = { Regular: GLYPH.clock, Gap: GLYPH.moon, Token: GLYPH.calendarClock };
export const ASIDE_GLYPHS: Record<string, Glyph> = { Halts: GLYPH.octagonAlert, Voids: GLYPH.scale, "Your money": GLYPH.wallet };
