import { phase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { Image } from "expo-image";
import { ChartNoAxesCombined, Dices, Handshake, Layers3, Mountain, Rocket, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { useLanesState } from "@/features/markets/lanes/useLanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { BRAND_LOGOS } from "~/components/logos/brand-logos";
import { Logo } from "~/components/logos/Logo";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { MarketCard } from "~/features/markets/board/MarketCard";
import { FONT, useTheme } from "~/theme";
import { ONBOARDING_UI, type OnboardingPage } from "./onboarding-copy";

/** The first Window trading right now, in any lane: the onboarding shows the real product, never a mock. */
function useLiveWindow(): { market: EventMarket | null; nowMs: number } {
  const venue = useVenue();
  const nowMs = useChainNowMs();
  const { laneSet } = useLanesState(venue.venueId);
  const markets = laneSet?.lanes.flatMap((lane) => lane.markets) ?? [];
  const market = nowMs > 0 ? (markets.find((m) => phase(m, nowMs) === "trading") ?? null) : null;
  return { market, nowMs };
}

/** Screen 1: the live Window card exactly as Markets draws it (touch off), or a plain plate while none trades. */
function CallVisual() {
  const { color } = useTheme();
  const { market, nowMs } = useLiveWindow();
  if (!market) {
    return (
      <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Text style={[styles.mono, { color: color.inkMuted }]}>UP · DOWN</Text>
        <Text style={[styles.plateBig, { color: color.ink }]}>Windows open every few minutes.</Text>
      </View>
    );
  }
  return (
    <View style={styles.cardWrap}>
      <View style={styles.liveRow}>
        <View style={[styles.liveDot, { backgroundColor: color.profit }]} />
        <Text style={[styles.mono, { color: color.inkMuted }]}>{ONBOARDING_UI.example}</Text>
      </View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <MarketCard market={market} nowMs={nowMs} />
      </View>
    </View>
  );
}

/** Screen 2: the two prints a Window is judged between, the stamp, and where the price comes from. */
function SettleVisual() {
  const { name, color } = useTheme();
  const w = ONBOARDING_UI.settle;
  return (
    <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.prints}>
        <View style={[styles.tag, { backgroundColor: color.hairline }]}>
          <Text style={[styles.tagText, { color: color.inkSecondary }]}>{w.opening}</Text>
        </View>
        <View style={[styles.rule, { backgroundColor: color.hairline }]} />
        <View style={[styles.tag, { backgroundColor: color.profit }]}>
          <Text style={[styles.tagText, { color: color.ground }]}>{`${w.closing} ▲`}</Text>
        </View>
      </View>
      <View style={[styles.stamp, { borderColor: color.accent }]}>
        <Text style={[styles.stampText, { color: color.accent }]}>{w.verdict}</Text>
      </View>
      <View style={[styles.sources, { borderTopColor: color.hairline }]}>
        <Image source={BRAND_LOGOS.pyth[name]} style={styles.pyth} contentFit="contain" accessible={false} />
        <Text style={[styles.mono, { color: color.inkMuted }]}>{w.sources}</Text>
      </View>
    </View>
  );
}

const GAME_ICONS: readonly LucideIcon[] = [Dices, Handshake, Layers3, Rocket, ChartNoAxesCombined, Mountain];

/** Screen 3: the six modes as the drawer lists them, icon tile and one line each. */
function PlayVisual() {
  const { color } = useTheme();
  return (
    <View style={styles.grid}>
      {ONBOARDING_UI.games.map((game, i) => {
        const Icon = GAME_ICONS[i] ?? Dices;
        return (
          <View key={game.name} style={[styles.game, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
            <View style={[styles.gameIcon, { borderColor: color.hairline }]}>
              <Icon size={18} color={i < 4 ? color.accent : color.inkSecondary} strokeWidth={1.75} />
            </View>
            <Text style={[styles.gameName, { color: color.ink }]}>{game.name}</Text>
            <Text style={[styles.gameLine, { color: color.inkMuted }]}>{game.line}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Screen 4: what the one signature gets you — test tUSDC on devnet. */
function StartVisual() {
  const { color } = useTheme();
  const f = ONBOARDING_UI.funds;
  return (
    <View style={[styles.plate, styles.funds, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.marks}>
        <TUsdcMark size={44} />
        <Logo brand="solana" size={30} />
      </View>
      <Text style={[styles.mono, { color: color.inkMuted }]}>{f.label}</Text>
      <Text style={[styles.fundsBig, { color: color.accent }]}>{f.amount}</Text>
      <Text style={[styles.mono, { color: color.inkSecondary }]}>{f.note}</Text>
    </View>
  );
}

export function OnboardingVisual({ page }: { page: OnboardingPage["key"] }) {
  if (page === "call") return <CallVisual />;
  if (page === "settle") return <SettleVisual />;
  if (page === "play") return <PlayVisual />;
  return <StartVisual />;
}

const styles = StyleSheet.create({
  cardWrap: { gap: 10 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  mono: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  plate: { borderRadius: 16, borderWidth: 1, padding: 22, gap: 14 },
  plateBig: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 28 },
  prints: { gap: 10 },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, height: 24, borderRadius: 4, justifyContent: "center" },
  tagText: { fontFamily: FONT.data, fontSize: 12 },
  rule: { height: 1, marginLeft: 8, width: "70%" },
  stamp: { alignSelf: "flex-end", borderWidth: 2, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, transform: [{ rotate: "-6deg" }] },
  stampText: { fontFamily: FONT.stamp, fontSize: 22, lineHeight: 28, letterSpacing: 1 },
  sources: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, borderTopWidth: 1 },
  pyth: { width: 62, height: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  game: { width: "48%", flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  gameIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  gameName: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 20 },
  gameLine: { fontFamily: FONT.body, fontSize: 12, lineHeight: 16 },
  funds: { alignItems: "center", paddingVertical: 32 },
  marks: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 6 },
  fundsBig: { fontFamily: FONT.headingHeavy, fontSize: 52, lineHeight: 56, letterSpacing: -2 },
});
