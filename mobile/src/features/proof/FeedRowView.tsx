import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import type { FeedRow } from "@/features/proof/feed";
import { PROOF_FEED as F } from "@/features/proof/feed-copy";
import { haptic, Pill, type PillTone } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { isProductUrl, openExternal } from "~/lib/external";
import { FONT, TYPE, useTheme } from "~/theme";
import { oraclePriceText } from "~/features/surface/parts";

const OUTCOME_TONE: Record<FeedRow["outcome"], PillTone> = { up: "profit", down: "loss", void: "neutral" };

/**
 * One settled Window as web's `FeedRowView` (features/proof/ProofFeedScreen.tsx): the asset's mark, "TSLA · 5m", when
 * it closed, the opening → closing print, the source (a link to the source's own feed where one is pinned) and how it
 * ended. The row opens the Window's print proof.
 */
export const FeedRowView = memo(function FeedRowView({ row, when }: { row: FeedRow; when: (sec: number) => string }) {
  const { color } = useTheme();
  const label = laneAssetLabel(row.asset, row.lane);
  const title = `${label} · ${laneCadenceLabel(row.lane, row.cadenceSec)}`;
  const prints = `${row.openE8 === null ? F.noPrint : oraclePriceText(row.openE8, row.asset)} → ${row.closeE8 === null ? F.noPrint : oraclePriceText(row.closeE8, row.asset)}`;
  const outcome = row.outcome === "void" && row.voidReason ? `${F.outcome.void} · ${F.voidReason[row.voidReason]}` : F.outcome[row.outcome];
  const sourceHref = row.sourceHref && !isProductUrl(row.sourceHref) ? row.sourceHref : null;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push({ pathname: "/proof/[id]", params: { id: row.market } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${F.closed(when(row.expirySec))}. ${prints}. ${row.sourceName ?? ""}. ${outcome}. Open proof`}
      style={({ pressed }) => [styles.row, { borderBottomColor: color.hairline }, pressed && { backgroundColor: color.surface1 }]}
    >
      <AssetDisc asset={label} size={34} />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={[TYPE.bodyStrong, styles.title, { color: color.ink }]} numberOfLines={1}>
            {title}
          </Text>
          <Pill label={outcome} tone={OUTCOME_TONE[row.outcome]} />
        </View>
        <Text style={[styles.mono, { color: color.inkMuted }]} numberOfLines={1}>
          {F.closed(when(row.expirySec))}
        </Text>
        <Text style={[TYPE.data, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
          {prints}
        </Text>
        <View style={styles.line}>
          {sourceHref ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                void openExternal(sourceHref);
              }}
              hitSlop={10}
              accessibilityRole="link"
              accessibilityLabel={F.sourceAria(row.sourceName ?? "")}
            >
              <Text style={[styles.mono, { color: color.accent }]}>{row.sourceName} ↗</Text>
            </Pressable>
          ) : (
            <Text style={[styles.mono, { color: color.inkSecondary }]}>{row.sourceName ?? F.noPrint}</Text>
          )}
          <Text style={[styles.mono, { color: color.accent }]}>{F.open}</Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flexShrink: 1 },
  mono: { fontFamily: FONT.data, fontSize: 11.5 },
});
