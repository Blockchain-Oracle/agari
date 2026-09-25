import { TICKERS } from "@agari/core/market";
import type { MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HEDGE } from "@/features/hedge/copy";
import type { HedgeCardState } from "@/features/hedge/hedge-state";
import type { HedgePick } from "@/features/hedge/hedge-target";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { presetStake } from "@/features/markets/ticket/stake-preset";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { wordsTokens } from "~/theme/web/markets-words";

const SHARES_DP = 8;
const SHARES_SHOWN_DP = 4;
const USD_DP = 6;
/** hedge.css under 480 px: the 44 px mark column and its 14 px gap, which the CTA row indents past. */
const MARK = 44;
const COLUMN_GAP = 14;

/** "12.5 TSLAx + 3 TSLAon": every verified token of the underlying, in shares (web's `holdingTokens`). */
export function holdingTokens(pick: HedgePick): string {
  return pick.holdings.map((h) => `${formatBaseUnits(h.sharesE8, SHARES_DP, { maxDp: SHARES_SHOWN_DP, minDp: 0 })} ${h.symbol}`).join(" + ");
}

type Kind = "offer" | "teaser";

/**
 * web's `.hg-banner` at phone width: mark | eyebrow · name · line, the CTA under the text, the foot across both. The
 * offer wears the vermilion wash and rim; the teaser is the plain surface. Web's inset bevel is drawn as two 2 pt bands.
 */
function Banner({ kind, mark, eyebrow, name, line, cta, foot, stamp, onPress, label }: {
  kind: Kind;
  mark: ReactNode;
  eyebrow: string;
  name: string;
  line: string;
  cta: ReactNode;
  foot: string;
  stamp?: string;
  onPress?: () => void;
  label: string;
}) {
  const { name: theme, color } = useTheme();
  const t = wordsTokens(theme);
  const offer = kind === "offer";
  const body = (
    <>
      {offer ? <LinearGradient colors={[t.hgWashFrom, color.surface1]} locations={[0, 0.7]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
      <View style={[styles.bevel, styles.bevelTop, { backgroundColor: t.hgBevelTop }]} />
      <View style={[styles.bevel, styles.bevelBottom, { backgroundColor: t.hgBevelBottom }]} />
      <View style={styles.row}>
        {mark}
        <View style={styles.text}>
          <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{eyebrow}</Text>
          <Text style={[styles.name, { color: color.ink }]}>{name}</Text>
          <Text style={[styles.line, { color: offer ? color.accent : color.inkSecondary }]}>{line}</Text>
        </View>
      </View>
      <View style={[styles.cta, stamp ? styles.ctaExample : null]}>{cta}</View>
      <Text style={[styles.foot, { color: color.inkMuted }]}>{foot}</Text>
      {stamp ? <Text style={[styles.stamp, { color: t.hgStampInk, backgroundColor: color.accent }]}>{stamp}</Text> : null}
    </>
  );
  const frame = [styles.banner, { backgroundColor: color.surface1, borderColor: offer ? t.hgOfferBorder : color.hairline }];
  if (!onPress) {
    return (
      <View style={frame} accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={frame}
    >
      {body}
    </Pressable>
  );
}

export interface HedgeCardProps {
  pick: HedgePick;
  /** The preset from `hedgeStakeBase`; null opens the ticket empty. */
  stakeBase: bigint | null;
  decimals: number;
  symbol: string;
  /** The markets page's selection, as a card's DOWN button calls it. */
  onSelect: (marketId: MarketId, side?: Side) => void;
  /** Example mode: a stamp over the card, its own CTA words, and a note in the foot. */
  stamp?: string;
  ctaText?: string;
  note?: string;
}

/**
 * web's `HedgeCard`: the holdings-aware cover in the season banner's anatomy; the whole card is the control. A tap
 * leaves the stake preset (10 % of what you hold) and opens the ticket on DOWN; nothing is sent from here.
 */
export function HedgeCard({ pick, stakeBase, decimals, symbol, onSelect, stamp, ctaText, note }: HedgeCardProps) {
  const { name: theme, color } = useTheme();
  const t = wordsTokens(theme);
  const { market, kind, horizon } = pick.target;
  const value = pick.exposureUsdE6 === null ? null : `$${formatBaseUnits(pick.exposureUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
  const line = HEDGE.line(holdingTokens(pick), value, TICKERS[pick.underlying].name, HEDGE.horizon[horizon]);
  const lead = pick.holdings[0];
  const cta = ctaText ?? HEDGE.cta[kind];
  const foot = [note, stakeBase !== null ? HEDGE.stake(formatBaseUnits(stakeBase, decimals), symbol) : null, HEDGE.foot(lead?.symbol ?? pick.underlying)].filter(Boolean).join(" ");
  const hedge = () => {
    if (stakeBase !== null) presetStake(market.marketId, stakeBase);
    onSelect(market.marketId, "down");
  };
  return (
    <Banner
      kind="offer"
      mark={
        <View style={[styles.glow, { shadowColor: t.hgMarkGlow }]}>
          <AssetDisc asset={pick.underlying} size={MARK} />
        </View>
      }
      eyebrow={HEDGE.eyebrow(lead?.issuer ?? "xstocks")}
      name={`${laneAssetLabel(market.asset, market.lane)} · ${laneTabLabel(market.lane, market.intervalSec)}`}
      line={line}
      cta={<Text style={[styles.ctaText, { color: color.inkSecondary }]}>{cta} →</Text>}
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
  const { name: theme, color } = useTheme();
  const t = wordsTokens(theme);
  const words =
    state.kind === "no-window"
      ? HEDGE.teaser.noWindow(TICKERS[state.lead.underlying].name)
      : state.kind === "calm"
        ? HEDGE.teaser.calm(TICKERS[state.lead.underlying].name)
        : HEDGE.teaser[teaserKey(state.kind)];
  const mark =
    state.kind === "no-window" || state.kind === "calm" ? (
      <AssetDisc asset={state.lead.underlying} size={MARK} />
    ) : (
      <View style={[styles.arrow, { backgroundColor: t.hgMarkFill }]} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={[styles.arrowGlyph, { color: color.inkSecondary }]}>↓</Text>
      </View>
    );
  return (
    <Banner
      kind="teaser"
      mark={mark}
      eyebrow={HEDGE.teaser.eyebrow}
      name={words.name}
      line={words.line}
      cta={
        <Pressable onPress={onExample} accessibilityRole="button" hitSlop={8}>
          {({ pressed }) => <Text style={[styles.exampleText, { color: pressed ? color.ink : color.inkSecondary }]}>{HEDGE.example.show} →</Text>}
        </Pressable>
      }
      foot={HEDGE.teaser.foot}
      label={`${words.name}. ${words.line}`}
    />
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: 96, marginBottom: 20, paddingVertical: 12, paddingHorizontal: 14, rowGap: 10, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  bevel: { position: "absolute", left: 0, right: 0, height: 2 },
  bevelTop: { top: 0 },
  bevelBottom: { bottom: 0 },
  row: { flexDirection: "row", alignItems: "center", columnGap: COLUMN_GAP },
  text: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2 },
  name: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 23.1, letterSpacing: -0.22 },
  line: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.48, fontVariant: ["tabular-nums"] },
  cta: { marginLeft: MARK + COLUMN_GAP },
  ctaExample: { marginTop: 18 },
  ctaText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  exampleText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24, letterSpacing: 1.8, textTransform: "uppercase", textAlign: "center" },
  foot: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.36 },
  stamp: { position: "absolute", top: 10, right: 14, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, overflow: "hidden", fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.62 },
  glow: { borderRadius: 9999, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  arrow: { width: MARK, height: MARK, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  arrowGlyph: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 22 },
});
