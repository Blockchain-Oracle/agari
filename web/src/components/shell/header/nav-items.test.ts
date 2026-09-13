import { describe, expect, it } from "vitest";
import { DOCS_URL } from "../../../lib/docs-url";
import {
  DESKTOP_NAV,
  isActiveNavItem,
  MOBILE_DRAWER_SECTIONS,
  MOBILE_NAV,
  NAVIGABLE_ROUTE_PATHS,
  NAV_ITEMS,
  type NavItem,
} from "./nav-items";

describe("navigation registry", () => {
  it("keeps the approved desktop and mobile fast paths compact", () => {
    expect(DESKTOP_NAV.map((entry) => (entry.kind === "link" ? entry.item.name : entry.group.name))).toEqual([
      "Markets",
      "Reels",
      "Games",
      "Build",
      "Explore",
      "Portfolio",
    ]);
    expect(MOBILE_NAV.map((item) => item.name)).toEqual(["Markets", "Reels", "Games", "Portfolio"]);
  });

  it("gives every drawer destination exactly one home", () => {
    const ids = MOBILE_DRAWER_SECTIONS.flatMap((section) => section.items.map((item) => item.id));
    expect(ids).toHaveLength(26);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every accepted user-facing route an explicit navigation home", () => {
    const destinations = [...MOBILE_NAV, ...MOBILE_DRAWER_SECTIONS.flatMap((section) => section.items)].map(
      (item) => item.href.split("?")[0],
    );
    const missing = NAVIGABLE_ROUTE_PATHS.filter((path) => !destinations.includes(path));

    expect(missing).toEqual([]);
  });

  it("keeps Trader Edge in Explore without also activating Portfolio", () => {
    expect(isActiveNavItem("/portfolio/edge", NAV_ITEMS.edge)).toBe(true);
    expect(isActiveNavItem("/portfolio/edge", NAV_ITEMS.portfolio)).toBe(false);
  });

  it("maps nested game and market routes to their top-level destinations", () => {
    expect(isActiveNavItem("/games/range", NAV_ITEMS.games)).toBe(true);
    expect(isActiveNavItem("/games/range", NAV_ITEMS.range)).toBe(true);
    expect(isActiveNavItem("/games/range", NAV_ITEMS.gamesHub)).toBe(false);
    expect(isActiveNavItem("/markets/example", NAV_ITEMS.markets)).toBe(true);
  });

  it("keeps documentation external and every application destination internal", () => {
    const items: NavItem[] = Object.values(NAV_ITEMS);
    expect(items.filter((item) => item.external).map((item) => item.id)).toEqual(["docs"]);
    expect(NAV_ITEMS.docs.href).toBe(DOCS_URL);
    expect(items.filter((item) => !item.external).every((item) => item.href.startsWith("/"))).toBe(true);
    expect(NAVIGABLE_ROUTE_PATHS).not.toContain("/docs");
    expect(isActiveNavItem("/docs", NAV_ITEMS.docs)).toBe(false);
  });
});
