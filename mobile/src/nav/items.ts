import type { AndroidSymbol, SFSymbol } from "expo-symbols";
import type { BrandLogo } from "~/components/logos/brand-logos";

/**
 * Web's phone drawer (web/src/components/shell/header/nav-items.ts MOBILE_DRAWER_SECTIONS): the same sections, names,
 * lines and routes, with SF Symbols (iOS) and Material Symbols (Android) standing in for web's lucide icons.
 */
export interface NavItem {
  name: string;
  href: string;
  description: string;
  icon: { ios: SFSymbol; android: AndroidSymbol };
  external?: boolean;
  /** A named brand shows its own mark instead of the symbol. */
  logo?: BrandLogo;
}

export interface NavSection {
  id: string;
  name: string;
  description: string;
  items: readonly NavItem[];
}

const item = (name: string, href: string, description: string, ios: SFSymbol, android: AndroidSymbol, external?: boolean, logo?: BrandLogo): NavItem =>
  ({ name, href, description, icon: { ios, android }, external, logo });

export const DRAWER_SECTIONS: readonly NavSection[] = [
  { id: "games-start", name: "Start", description: "Choose or learn", items: [
    item("Games hub", "/games", "Choose a mode or resume a run.", "gamecontroller.fill", "sports_esports"),
    item("Practice", "/games/practice", "Learn the swipe loop without stakes.", "target", "target"),
  ] },
  { id: "games-prediction", name: "Prediction", description: "Market-backed play", items: [
    item("Duel", "/games/duel", "Face another player over a live deck.", "person.2.fill", "handshake"),
    item("Lucky", "/games/lucky", "Let the reel find a live market call.", "dice.fill", "casino"),
    item("Range", "/games/range", "Pick the band where price should finish.", "square.3.layers.3d", "layers"),
    item("Moonshot", "/games/moonshot", "Aim for a distant price target.", "paperplane.fill", "rocket_launch"),
  ] },
  { id: "games-arcade", name: "Arcade", description: "Score-only runs", items: [
    item("Line Rider", "/games/line-rider", "Ride the line and build a combo.", "chart.line.uptrend.xyaxis", "ssid_chart"),
    item("Candle Hop", "/games/candle-hop", "Hop through a candlestick run.", "mountain.2.fill", "landscape"),
  ] },
  { id: "automate", name: "Automate", description: "Playbooks and agents", items: [
    item("Strategies", "/strategies", "Explore repeatable trading approaches.", "brain.head.profile", "psychology"),
    item("Agents", "/agents", "Manage automated market agents.", "cpu", "smart_toy"),
    item("Desk", "/desk", "Hold a basket of pre-IPO names under your rules", "briefcase.fill", "work"),
    item("X-trade", "/trade-from-x", "Turn a post into a bounded trade.", "at", "alternate_email", false, "x"),
  ] },
  { id: "trade", name: "Trade", description: "More ways to make a call", items: [
    item("Baskets", "/baskets", "Bet on a small group of pre-IPO companies together.", "square.stack.3d.up.fill", "stacks"),
    item("Short", "/short", "Sell a stock's fall, and manage the position.", "chart.line.downtrend.xyaxis", "trending_down"),
    item("Earn", "/earn", "Put capital into earning opportunities.", "dollarsign.circle.fill", "paid"),
    item("Parlay", "/parlay", "Combine several market outcomes.", "link", "link"),
    item("Sensei", "/sensei", "Ask the market assistant.", "bubble.left.and.bubble.right.fill", "forum"),
  ] },
  { id: "proof", name: "Proof", description: "Records and market evidence", items: [
    item("Print proof", "/proof", "Every settled Window and the signed prints that decided it.", "checkmark.seal.fill", "verified"),
    item("Leaderboard", "/leaderboard", "See the strongest verified records.", "trophy.fill", "emoji_events"),
    item("Activity", "/activity", "Your fills, verdicts, payouts and follows.", "tray.fill", "inbox"),
    item("Stats", "/stats", "Inspect protocol and market activity.", "chart.bar.fill", "bar_chart"),
    item("Market Surface", "/surface", "Read the market structure at a glance.", "square.grid.3x3.fill", "grid_view"),
    item("Trader Edge", "/portfolio/edge", "Review your trading edge report.", "waveform.path.ecg", "monitoring"),
  ] },
  { id: "learn", name: "Learn", description: "Guidance and context", items: [
    item("News", "/news", "Follow the stories moving markets.", "newspaper.fill", "newspaper"),
    item("How it works", "/how-it-works", "Understand the product from end to end.", "questionmark.circle.fill", "help"),
    item("Docs", "https://docs.useagari.xyz", "Read step-by-step guides and product documentation.", "book.fill", "menu_book", true),
    item("Status", "/status", "Check connected services and contracts.", "waveform", "sensors"),
    item("Download", "/download", "Get Agari on your other devices.", "arrow.down.circle.fill", "download"),
    item("Demo", "/demo", "Walk through the complete product story.", "play.rectangle.fill", "slideshow"),
    item("Pitch", "/pitch", "Read the concise Agari thesis.", "rectangle.on.rectangle", "co_present"),
  ] },
  { id: "account", name: "Account", description: "Notifications and recovery", items: [
    item("Notifications", "/notifications", "Choose what this phone hears about your calls.", "bell.badge.fill", "notifications"),
    item("X recovery", "/claim", "Recover a trade created from X.", "key.fill", "key", false, "x"),
  ] },
];
