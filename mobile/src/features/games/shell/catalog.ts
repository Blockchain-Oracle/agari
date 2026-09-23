import { gameDescriptor, gamesInGroup, type GameDescriptor, type GameGroup, type GameId } from "@agari/core/games";
import { DRAWER_SECTIONS, type NavItem } from "~/nav/items";

/**
 * web's `features/games/catalog.ts` on the phone: what a mode is to a player standing in the hub.
 *
 * The name, blurb, symbol and route come from the app's navigation registry (web takes them from its own
 * `NAV_ITEMS`), so a mode is never called one thing in the drawer and another on its card. The economic kind
 * and label come from `@agari/core/games`, the same fact the write lanes gate on. `readiness` is web's build
 * fact, unchanged: every mode is built.
 */
export type GameReadiness = { kind: "built" } | { kind: "pending"; dependency: string };

export interface GameEntry {
  id: GameId;
  nav: NavItem;
  descriptor: GameDescriptor;
  readiness: GameReadiness;
}

const HREF: Readonly<Record<GameId, string>> = {
  practice: "/games/practice",
  duel: "/games/duel",
  lucky: "/games/lucky",
  range: "/games/range",
  moonshot: "/games/moonshot",
  "line-rider": "/games/line-rider",
  "candle-hop": "/games/candle-hop",
};

const READINESS: Readonly<Record<GameId, GameReadiness>> = {
  practice: { kind: "built" },
  duel: { kind: "built" },
  lucky: { kind: "built" },
  range: { kind: "built" },
  moonshot: { kind: "built" },
  "line-rider": { kind: "built" },
  "candle-hop": { kind: "built" },
};

const NAV = new Map(DRAWER_SECTIONS.flatMap((section) => section.items).map((item) => [item.href, item]));

function navOf(id: GameId): NavItem {
  const item = NAV.get(HREF[id]);
  if (!item) throw new Error(`games catalog: no navigation item for ${HREF[id]}`);
  return item;
}

export function gameEntry(id: GameId): GameEntry {
  return { id, nav: navOf(id), descriptor: gameDescriptor(id), readiness: READINESS[id] };
}

export function gameEntriesInGroup(group: GameGroup): readonly GameEntry[] {
  return gamesInGroup(group).map((descriptor) => gameEntry(descriptor.id));
}

/** The mode a route belongs to, or null on the hub and the shell's own pages (history, rank). */
export function gameIdFromPath(pathname: string | null): GameId | null {
  if (!pathname) return null;
  const rest = pathname.startsWith("/games/") ? pathname.slice("/games/".length) : null;
  if (!rest) return null;
  const id = rest.split("/")[0] ?? "";
  return id in HREF ? (id as GameId) : null;
}
