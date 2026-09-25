import {
  CalendarClock,
  Clock,
  Coins,
  EyeOff,
  Layers,
  ListChecks,
  Lock,
  Moon,
  OctagonAlert,
  Scale,
  Shield,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react-native";

/**
 * web content.ts / sessions.ts carry lucide-react icons beside their words; the app draws the same lucide glyphs
 * (lucide-react-native), keyed the way those modules key them.
 */
export const LABEL_ICONS = { sessions: CalendarClock, architecture: Shield, baskets: Layers, desk: ListChecks } as const;

/** content.ts STEPS, by number: Coins, Target, Zap, Trophy. */
export const STEP_ICONS: Record<number, LucideIcon> = { 1: Coins, 2: Target, 3: Zap, 4: Trophy };

/** content.ts MECHANICS, by title. */
export const MECHANIC_ICONS: Record<string, LucideIcon> = {
  "Order-Book Pricing": Coins,
  "Live Price": TrendingUp,
  "Fast Rounds": Clock,
  "On-Chain Settlement": Shield,
};

/** content.ts ARCHITECTURE, by title. */
export const ARCH_ICONS: Record<string, LucideIcon> = { "Transparent Positions": EyeOff, "Instant Finality": Lock, "Program Settlement": Shield };

/** sessions.ts LANES and ASIDES, by name. */
export const LANE_ICONS: Record<string, LucideIcon> = { Regular: Clock, Gap: Moon, Token: CalendarClock };
export const ASIDE_ICONS: Record<string, LucideIcon> = { Halts: OctagonAlert, Voids: Scale, "Your money": Wallet };
