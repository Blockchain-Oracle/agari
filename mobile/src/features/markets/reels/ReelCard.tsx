import { countdown } from "@agari/core/lifecycle";
import { neededMove } from "@agari/core/market";
import type { EventMarket, Side } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { useOpeningPrice } from "@agari/markets/react";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { assetPriceLine, assetSpotLine } from "@/features/markets/hero/units";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { formatCadence, REELS } from "@/lib/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { SideButtons } from "~/components/window/SideButtons";
import { WindowLine } from "~/components/window/WindowLine";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** Local wall-clock hour and minute — the reference's `clockHM`, in the viewer's own zone. */
function closesAt(expirySec: number): string {
  return new Date(expirySec * 1_000).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit" });
}

interface Props {
  market: EventMarket;
  /** False for a card more than one swipe away: it keeps its frame and reads nothing live. */
  near: boolean;
  /** The Window no longer takes entries — the call row says so instead of offering a side. */
  closing: boolean;
  height: number;
}

/**
 * web's ReelCard: one Window as a full-screen portrait card — who and when, the question against the opening print,
 * the live price and its distance from the line, the live line itself, and the call. Every live read is gated on
 * `near`, so a reel of a dozen Windows holds three subscriptions, not twelve.
 */
export const ReelCard = memo(function ReelCard({ market, near, closing, height }: Props) {
  const { color } = useTheme();
  const opening = useOpeningPrice(near ? market.marketId : null);
  const spotRaw = useOracleSpot(near ? market.asset : null);
  const book = useTopOfBook(near ? market : null);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  const pick = (side: Side) => router.push({ pathname: "/ticket", params: { m: market.marketId, dir: side } });
  return (
    <View style={[styles.slot, { height }]}>
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <ReelHead market={market} />
        <ReelQuestion asset={market.asset} openingRaw={openingRaw} currentRaw={spotRaw} />
        <Pressable style={styles.chart} onPress={() => router.push({ pathname: "/markets/[id]", params: { id: market.marketId } })} accessibilityRole="link" accessibilityLabel={`Open the ${market.asset} Window`}>
          {near ? (
            <WindowLine market={market} height={Math.max(160, Math.round(height * 0.34))} />
          ) : (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{REELS.swipeToRead}</Text>
          )}
        </Pressable>
        {closing ? (
          <Text style={[TYPE.bodyStrong, styles.closing, { color: color.inkSecondary }]}>{REELS.closing}</Text>
        ) : (
          <SideButtons upCents={book.upCents} downCents={book.downCents} hydrating={book.hydrating} onPick={pick} height={60} />
        )}
      </View>
    </View>
  );
});

/** web's ReelHead: asset, round length, closing time, and the clock (vermilion once urgent). It reads the clock itself. */
function ReelHead({ market }: { market: EventMarket }) {
  const { color } = useTheme();
  const nowMs = useChainNowMs();
  const state = nowMs > 0 ? countdown(nowMs, market.expirySec, market.intervalSec) : null;
  return (
    <View style={styles.head}>
      <View style={styles.ident}>
        <AssetDisc asset={market.asset} size={40} />
        <View style={styles.grow}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>{REELS.settlesOn(market.asset)}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{REELS.round(formatCadence(market.intervalSec), closesAt(market.expirySec))}</Text>
        </View>
      </View>
      <View style={styles.clock}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{REELS.closesIn}</Text>
        <Text style={[TYPE.dataLg, { color: state?.urgent ? color.accent : color.ink }]}>{state ? formatClock(state.remainingSec) : REELS.noClock}</Text>
      </View>
    </View>
  );
}

/** web's ReelQuestion: "Will TSLA be above $415.20?", the live price, and "+$0.83 vs line" — the rule from core `neededMove`. */
function ReelQuestion({ asset, openingRaw, currentRaw }: { asset: string; openingRaw: bigint | null; currentRaw: bigint | null }) {
  const { color } = useTheme();
  const move = openingRaw !== null && currentRaw !== null ? neededMove(currentRaw, openingRaw) : null;
  const above = move ? move.upNeedsRaw === 0n : null;
  return (
    <View style={styles.ask}>
      <Text style={[styles.question, { color: color.ink }]}>
        {REELS.holdsAbove(asset)}{" "}
        <Text style={{ color: openingRaw === null ? color.inkMuted : color.accent }}>{openingRaw === null ? REELS.noLine : assetPriceLine(asset, openingRaw)}</Text>?
      </Text>
      <View style={styles.spot}>
        <Text style={[TYPE.dataLg, { color: color.ink }]}>{currentRaw === null ? REELS.noLine : assetSpotLine(asset, currentRaw)}</Text>
        {move && openingRaw !== null && currentRaw !== null ? (
          <Text style={[TYPE.data, { color: above ? color.profit : color.loss }]}>
            {above ? "+" : "−"}
            {assetPriceLine(asset, above ? currentRaw - openingRaw : move.upNeedsRaw, openingRaw)} {REELS.versusLine}
          </Text>
        ) : null}
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{REELS.livePrice}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { paddingHorizontal: 12, paddingVertical: 8 },
  card: { flex: 1, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 16, justifyContent: "space-between" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  ident: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  grow: { flex: 1 },
  clock: { alignItems: "flex-end" },
  ask: { gap: 8 },
  question: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  spot: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  chart: { flex: 1, justifyContent: "center", minHeight: 160 },
  closing: { textAlign: "center", paddingVertical: 18 },
});
