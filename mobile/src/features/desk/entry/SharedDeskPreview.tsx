import { presetById } from "@agari/core/desk";
import { isOk } from "@agari/core/schemas";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { ENTRY } from "@/features/desk/entry/copy-entry";
import { ago, usd } from "@/features/desk/format";
import { useDeskView } from "@/features/desk/useDesk";
import { nativeDeskView as deskView, type NativeDeskView as DeskView } from "../native-view";
import { Card, EmptyState, Skeleton } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { FillSparkline, LogoStack, StatusDot, TONE, toneInk } from "../kit";

const P = ENTRY.preview;
/** Display only: E6 money as dollars for the sparkline. */
const dollars = (e6: bigint): number => Number(e6) / 1e6;

/**
 * A live card of a desk its owner shares (web's entry/SharedDeskPreview.tsx), read through the same query as the
 * desk page so opening it is instant. Never a made-up figure: a skeleton while it loads, the reason when it cannot.
 */
export function SharedDeskPreview({ id }: { id: string }) {
  const reading = useDeskView(id, null);
  if (reading === null) return <Skeleton height={220} radius={RADIUS.lg} />;
  if (!isOk(reading)) return <EmptyState why={P.unavailable} />;
  return <SharedDeskCard id={id} view={deskView(reading.value)} />;
}

export function SharedDeskCard({ id, view }: { id: string; view: DeskView }) {
  const { color } = useTheme();
  const preset = view.mandate?.preset ? presetById(view.mandate.preset) : null;
  const symbols = view.mandate ? view.mandate.targets.tokens.map((t) => t.symbol) : view.holdings.map((h) => h.symbol);
  const latest = view.wire.latest;
  const tone = latest ? TONE[latest.outcome] : null;
  const line = view.series.map((p) => dollars(p.totalE6));
  return (
    <Card onPress={() => router.push(`/desk/${id}`)} accessibilityLabel={`${P.kicker}: ${preset?.name ?? DESK.visitorTitle}. ${P.open}`}>
      <View style={styles.head}>
        {preset ? <AssetDisc asset={preset.basket} size={40} /> : <LogoStack symbols={symbols} size={26} />}
        <View style={styles.name}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.kicker}</Text>
          <Text style={[TYPE.title, { color: color.ink }]} numberOfLines={1}>
            {preset?.name ?? DESK.visitorTitle}
          </Text>
        </View>
        <StatusDot tone={view.isLive ? "live" : "practice"} label={DESK.modes[view.mode]} />
      </View>
      <View style={styles.value}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.total}</Text>
        <Text style={[TYPE.dataHero, styles.figure, { color: color.ink }]}>{view.plate.totalE6 !== null ? usd(view.plate.totalE6) : "—"}</Text>
        {line.length > 1 ? <FillSparkline values={line} height={44} /> : null}
      </View>
      {symbols.length > 0 ? <LogoStack symbols={symbols} size={20} max={8} /> : null}
      {latest && tone ? (
        <View style={[styles.latest, { borderColor: color.hairline }]}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>
            {P.latest} · {ago(latest.decidedAtSec, view.wire.nowSec)}
          </Text>
          <Text style={[TYPE.bodyStrong, { color: toneInk(tone, color) }]}>{RECORD.outcome[latest.outcome]}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={3}>
            {latest.summary}
          </Text>
        </View>
      ) : null}
      <View style={styles.foot}>
        <Text style={[TYPE.data, { color: color.inkMuted }]}>{P.checks(latest?.seq ?? 0)}</Text>
        <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{P.open} →</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { flex: 1, gap: 2 },
  value: { gap: 6 },
  figure: { fontSize: 34, lineHeight: 38 },
  latest: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
});
