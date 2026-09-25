import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import type { FeedRow } from "@/features/proof/feed";
import { PROOF_FEED as F } from "@/features/proof/feed-copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { isProductUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { exploreTokens } from "~/theme/web/explore";
import { proofTokens } from "~/theme/web/explore/proof";
import { statusTokens } from "~/theme/web/explore/status";
import { Skeleton } from "./Frame";
import { oraclePriceText } from "./price";

/**
 * web's `FeedRowView` (ProofFeedScreen.tsx) at phone width (proof-feed.css ≤ 640 px): the mark down the left; the
 * name and close time beside the outcome pill; then the prints; then the source. The whole row opens the proof; the
 * source's own feed link sits above it.
 */
export const FeedRowView = memo(function FeedRowView({ row, when, first }: { row: FeedRow; when: (sec: number) => string; first: boolean }) {
  const { name, color } = useTheme();
  const e = exploreTokens(name);
  const p = proofTokens(name);
  const s = statusTokens(name);
  const label = laneAssetLabel(row.asset, row.lane);
  const title = `${label} · ${laneCadenceLabel(row.lane, row.cadenceSec)}`;
  const prints = `${row.openE8 === null ? F.noPrint : oraclePriceText(row.openE8, row.asset)} → ${row.closeE8 === null ? F.noPrint : oraclePriceText(row.closeE8, row.asset)}`;
  const outcome = row.outcome === "void" && row.voidReason ? `${F.outcome.void} · ${F.voidReason[row.voidReason]}` : F.outcome[row.outcome];
  const sourceHref = row.sourceName && row.sourceHref && !isProductUrl(row.sourceHref) ? row.sourceHref : null;
  const pill =
    row.outcome === "up"
      ? { color: color.profit, borderColor: color.profit, backgroundColor: color.profitWash }
      : row.outcome === "down"
        ? { color: color.loss, borderColor: color.loss, backgroundColor: color.lossWash }
        : { color: color.inkMuted, borderColor: p.gray700 };
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push({ pathname: "/proof/[id]", params: { id: row.market } });
      }}
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${F.closed(when(row.expirySec))}. ${prints}. ${row.sourceName ?? ""}. ${outcome}`}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: 1, borderTopColor: s.rule }, pressed && { backgroundColor: s.hover }]}
    >
      <AssetDisc asset={label} size={28} />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.name}>
            <Text style={[styles.title, { color: color.ink }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.when, { color: color.inkMuted }]} numberOfLines={1}>
              {F.closed(when(row.expirySec))}
            </Text>
          </View>
          <Text style={[styles.outcome, { color: pill.color, borderColor: pill.borderColor, backgroundColor: pill.backgroundColor }]}>{outcome.toUpperCase()}</Text>
        </View>
        <Text style={[styles.prints, { color: e.gray300 }]} numberOfLines={1}>
          {prints}
        </Text>
        {sourceHref ? (
          <Text
            onPress={() => {
              haptic.tap();
              void openExternal(sourceHref);
            }}
            accessibilityRole="link"
            accessibilityLabel={F.sourceAria(row.sourceName ?? "")}
            suppressHighlighting
            style={[styles.source, styles.sourceLink, { color: color.inkSecondary, textDecorationColor: p.gray700 }]}
          >
            {row.sourceName} ↗
          </Text>
        ) : (
          <Text style={[styles.source, { color: color.inkSecondary }]}>{row.sourceName ?? F.noPrint}</Text>
        )}
      </View>
    </Pressable>
  );
});

/** web's `SkeletonRows` row: the mark, two name bars, the prints bar, the pill. */
export function FeedSkeletonRow({ first }: { first: boolean }) {
  const { name } = useTheme();
  const s = statusTokens(name);
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: s.rule }]}>
      <Skeleton style={styles.skMark} />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.name}>
            <Skeleton style={styles.skTitle} />
            <Skeleton style={styles.skWhen} />
          </View>
          <Skeleton style={styles.skPill} />
        </View>
        <Skeleton style={styles.skPrints} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 12, paddingHorizontal: 16 },
  body: { flex: 1, minWidth: 0, gap: 6 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  name: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: FONT.bodyMedium, fontSize: 13, lineHeight: 20.8 },
  when: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  outcome: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 9999,
    overflow: "hidden",
    fontFamily: FONT.dataRegular,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1,
  },
  prints: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"] },
  source: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.44 },
  sourceLink: { alignSelf: "flex-start", textDecorationLine: "underline" },
  skMark: { width: 28, height: 28, borderRadius: 14 },
  skTitle: { width: 112, height: 14 },
  skWhen: { width: 160, height: 12 },
  skPill: { width: 80, height: 20, borderRadius: 9999 },
  skPrints: { width: 144, height: 14 },
});
