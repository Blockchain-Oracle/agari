import { NAV } from "@/lib/copy";

// Icons are resolved inside the client NavLink; keys keep this list serializable across the RSC boundary.
export type NavIconKey = "markets" | "reels" | "portfolio";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/markets", label: NAV.markets, icon: "markets" },
  { href: "/reels", label: NAV.reels, icon: "reels" },
  { href: "/portfolio", label: NAV.portfolio, icon: "portfolio" },
];
