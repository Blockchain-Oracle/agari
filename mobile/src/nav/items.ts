import {
  Activity, BadgeCheck, BarChart3, BookOpen, Bot, Boxes, Briefcase, ChartCandlestick, ChartNoAxesCombined, CircleHelp, CirclePlus,
  Clapperboard, Coins, Dices, Download, Gamepad2, Goal, Handshake, Inbox, KeyRound, Layers3, MessageSquare, Mountain, Newspaper, Presentation,
  Rocket, ScanSearch, TrendingDown, Trophy, type LucideIcon,
} from "lucide-react-native";
import type { BrandLogo } from "~/components/logos/brand-logos";

/**
 * Web's phone drawer (web/src/components/shell/header/nav-items.ts MOBILE_DRAWER_SECTIONS): the same sections, names,
 * lines, routes and lucide icons.
 */
export interface NavItem {
  name: string;
  href: string;
  description: string;
  icon: LucideIcon;
  external?: boolean;
  beta?: boolean;
  /** A named brand shows its own mark instead of the icon (web's XLogo). */
  logo?: BrandLogo;
}

export interface NavSection {
  id: string;
  name: string;
  description: string;
  items: readonly NavItem[];
}

const item = (name: string, href: string, description: string, icon: LucideIcon, extra: Partial<NavItem> = {}): NavItem =>
  ({ name, href, description, icon, ...extra });

export const DRAWER_SECTIONS: readonly NavSection[] = [
  { id: "games-start", name: "Start", description: "Choose or learn", items: [
    item("Games hub", "/games", "Choose a mode or resume a run.", Gamepad2),
    item("Practice", "/games/practice", "Learn the swipe loop without stakes.", Goal),
  ] },
  { id: "games-prediction", name: "Prediction", description: "Market-backed play", items: [
    item("Duel", "/games/duel", "Face another player over a live deck.", Handshake),
    item("Lucky", "/games/lucky", "Let the reel find a live market call.", Dices),
    item("Range", "/games/range", "Pick the band where price should finish.", Layers3),
    item("Moonshot", "/games/moonshot", "Aim for a distant price target.", Rocket),
  ] },
  { id: "games-arcade", name: "Arcade", description: "Score-only runs", items: [
    item("Line Rider", "/games/line-rider", "Ride the line and build a combo.", ChartNoAxesCombined),
    item("Candle Hop", "/games/candle-hop", "Hop through a candlestick run.", Mountain),
  ] },
  { id: "automate", name: "Automate", description: "Playbooks and agents", items: [
    item("Strategies", "/strategies", "Explore repeatable trading approaches.", Bot, { beta: true }),
    item("Agents", "/agents", "Manage automated market agents.", Bot),
    item("Desk", "/desk", "Hold a basket of pre-IPO names under your rules", Briefcase),
    item("Create a desk", "/desk/new", "Pick a basket, set its limits, start in practice.", CirclePlus),
    item("X-trade", "/trade-from-x", "Turn a post into a bounded trade.", Bot, { logo: "x" }),
  ] },
  { id: "trade", name: "Trade", description: "More ways to make a call", items: [
    item("Baskets", "/baskets", "Bet on a small group of pre-IPO companies together.", Boxes),
    item("Short", "/short", "Sell a stock's fall, and manage the position.", TrendingDown),
    item("Earn", "/earn", "Put capital into earning opportunities.", Coins),
    item("Parlay", "/parlay", "Combine several market outcomes.", ChartNoAxesCombined),
    item("Sensei", "/sensei", "Ask the market assistant.", MessageSquare),
  ] },
  { id: "proof", name: "Proof", description: "Records and market evidence", items: [
    item("Print proof", "/proof", "Every settled Window and the signed prints that decided it.", BadgeCheck),
    item("Leaderboard", "/leaderboard", "See the strongest verified records.", Trophy),
    item("Activity", "/activity", "Your fills, verdicts and payouts.", Inbox),
    item("Stats", "/stats", "Inspect protocol and market activity.", BarChart3),
    item("Market Surface", "/surface", "Read the market structure at a glance.", ScanSearch),
    item("Trader Edge", "/portfolio/edge", "Review your trading edge report.", ChartCandlestick),
  ] },
  { id: "learn", name: "Learn", description: "Guidance and context", items: [
    item("News", "/news", "Follow the stories moving markets.", Newspaper),
    item("How it works", "/how-it-works", "Understand the product from end to end.", CircleHelp),
    item("Docs", "https://docs.useagari.xyz", "Read step-by-step guides and product documentation.", BookOpen, { external: true }),
    item("Status", "/status", "Check connected services and contracts.", Activity),
    item("Download", "/download", "Get Agari on your other devices.", Download),
    item("Demo", "/demo", "Walk through the complete product story.", Clapperboard),
    item("Pitch", "/pitch", "Read the concise Agari thesis.", Presentation),
  ] },
  { id: "account", name: "Account", description: "Recovery", items: [
    item("X recovery", "/claim", "Recover a trade created from X.", KeyRound),
  ] },
];
