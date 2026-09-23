import { TICKERS } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HEDGE } from "@/features/hedge/copy";
import type { HedgeCardState } from "@/features/hedge/hedge-state";
import type { HedgePick } from "@/features/hedge/hedge-target";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { presetStake } from "@/features/markets/ticket/stake-preset";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const SHARES_DP = 8;
const SHARES_SHOWN_DP = 4;
const USD_DP = 6;

/** "12.5 TSLAx + 3 TSLAon": every verified token of the underlying, in shares (web's `holdingTokens`). */
export function holdingTokens(pick: HedgePick): string {
  return pick.holdings.map((h) => `${formatBaseUnits(h.sharesE8, SHARES_DP, { maxDp: SHARES_SHOWN_DP, minDp: 0 })} ${h.symbol}`).join(" + ");
}

/** web's `.hg-banner` anatomy: mark · eyebrow / name / line · CTA, then the honest foot. */
function Banner({ mark, eyebrow, name, line, cta, foot, stamp, onPress, label }: {
  mark: ReactNode;
  eyebrow: string;
  name: string;
  line: string;
  cta: string;
  foot: string;
  stamp?: string;
  onPress: () => void;
  label: string;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: color.surface1, borderColor: stamp ? color.warning : color.accentDim, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      {stamp ? <Text style={[styles.stamp, { color: color.warning, borderColor: color.warning }]}>{stamp}</Text> : null}
      <View style={styles.top}>
        {mark}
        <View style={styles.text}>
          <Text style={[styles.eyebrow, { color: color.accent }]}>{eyebrow}</Text>
          <Text style={[TYPE.title, { color: color.ink }]}>{name}</Text>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{line}</Text>
        </View>
      </View>
      <View style={[styles.cta, { backgroundColor: color.accent }]}>
        <Text style={[styles.ctaText, { color: color.onAccent }]}>{cta}</Text>
        <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={15} tintColor={color.onAccent} />
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{foot}</Text>
    </Pressable>
  );
}

export interface HedgeCardProps {
  pick: HedgePick;
  /** The preset from `hedgeStakeBase`; null opens the ticket empty. */
  stakeBase: bigint | null;
  decimals: number;
  symbol: string;
  /** Example mode: a stamp, its own CTA and a note; the press hides the example instead of opening the ticket. */
  stamp?: string;
  ctaText?: string;
  note?: string;
  onExampleHide?: () => void;
}

/**
 * web's `HedgeCard` (features/hedge/HedgeCard.tsx): "insure what you hold". A press leaves the stake preset (10% of
 * what you hold, web's `presetStake`) and opens the one Ticket on Down; nothing is signed from here.
 */
export function HedgeCard({ pick, stakeBase, decimals, symbol, stamp, ctaText, note, onExampleHide }: HedgeCardProps) {
  const { market, kind, horizon } = pick.target;
  const value = pick.exposureUsdE6 === null ? null : `$${formatBaseUnits(pick.exposureUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
  const line = HEDGE.line(holdingTokens(pick), value, TICKERS[pick.underlying].name, HEDGE.horizon[horizon]);
  const lead = pick.holdings[0];
  const cta = ctaText ?? HEDGE.cta[kind];
  const foot = [note, stakeBase !== null ? HEDGE.stake(formatBaseUnits(stakeBase, decimals), symbol) : null, HEDGE.foot(lead?.symbol ?? pick.underlying)]
    .filter(Boolean)
    .join(" ");
  const hedge = () => {
    if (onExampleHide) {
      onExampleHide();
      return;
    }
    if (stakeBase !== null) presetStake(market.marketId, stakeBase);
    router.push({ pathname: "/ticket", params: { m: market.marketId, dir: "down" } });
  };
  return (
    <Banner
      mark={<AssetDisc asset={pick.underlying} size={40} />}
      eyebrow={HEDGE.eyebrow(lead?.issuer ?? "xstocks")}
      name={`${laneAssetLabel(market.asset, market.lane)} · ${laneTabLabel(market.lane, market.intervalSec)}`}
      line={line}
      cta={cta}
      foot={foot}
      stamp={stamp}
      onPress={hedge}
      label={`${cta}: ${HEDGE.aria(line)}`}
    />
  );
}

const teaserKey = (kind: "no-wallet" | "reading" | "unreadable" | "no-holding") =>
  kind === "no-wallet" ? "noWallet" : kind === "reading" ? "reading" : kind === "unreadable" ? "unreadable" : "noHolding";

/** web's `HedgeTeaser`: the card with no offer to make; it still says what the feature is and offers the example. */
export function HedgeTeaser({ state, onExample }: { state: Exclude<HedgeCardState, { kind: "offer" }>; onExample: () => void }) {
  const { color } = useTheme();
  const words =
    state.kind === "no-window"
      ? HEDGE.teaser.noWindow(TICKERS[state.lead.underlying].name)
      : state.kind === "calm"
        ? HEDGE.teaser.calm(TICKERS[state.lead.underlying].name)
        : HEDGE.teaser[teaserKey(state.kind)];
  const mark =
    state.kind === "no-window" || state.kind === "calm" ? (
      <AssetDisc asset={state.lead.underlying} size={40} />
    ) : (
      <View style={[styles.glyph, { backgroundColor: color.accentWash }]}>
        <SymbolView name={{ ios: "arrow.down", android: "arrow_downward" }} size={18} tintColor={color.accent} />
      </View>
    );
  return (
    <Banner
      mark={mark}
      eyebrow={HEDGE.teaser.eyebrow}
      name={words.name}
      line={words.line}
      cta={HEDGE.example.show}
      foot={HEDGE.teaser.foot}
      onPress={onExample}
      label={`${words.name}. ${words.line}. ${HEDGE.example.show}`}
    />
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 16, gap: 12 },
  stamp: { alignSelf: "flex-start", fontFamily: FONT.dataStrong, fontSize: 10.5, letterSpacing: 1, borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  top: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  text: { flex: 1, gap: 3 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.4 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: RADIUS.md },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 16 },
  glyph: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
