import { presetById } from "@agari/core/desk";
import { isOk } from "@agari/core/schemas";
import { router } from "expo-router";
import { ArrowUpRight, CircleDashed } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TONE } from "@/features/desk/activity/check-groups";
import { DESK } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { ENTRY } from "@/features/desk/entry/copy-entry";
import { ago, usd } from "@/features/desk/format";
import { useDeskView } from "@/features/desk/useDesk";
import { Skeleton } from "~/components/portfolio/web";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme, type Palette } from "~/theme";
import { LogoStack, Sparkline, StatusDot } from "../kit";
import { nativeDeskView as deskView, type NativeDeskView as DeskView } from "../native-view";
import { DashedRule, EmptyState, Wash } from "../studio/kit-bits";

const P = ENTRY.preview;
/** Display only: E6 money as dollars for the sparkline. */
const dollars = (e6: bigint): number => Number(e6) / 1e6;

/** entry.css `.en-preview-verdict[data-tone]`. */
function verdictInk(tone: string, color: Palette): string {
  if (tone === "acted") return color.profit;
  if (tone === "declined") return color.accent;
  if (tone === "asked") return color.warning;
  if (tone === "error" || tone === "stopped") return color.loss;
  return color.inkSecondary;
}

/**
 * web's entry/SharedDeskPreview.tsx: a live card of a desk its owner shares, read through the same query as the desk
 * page so opening it is instant. Never a made-up figure: a skeleton while it loads, the reason when it cannot.
 */
export function SharedDeskPreview({ id }: { id: string }) {
  const { color } = useTheme();
  const reading = useDeskView(id, null);
  if (reading === null) return <Skeleton height={320} radius={20} />;
  if (!isOk(reading)) {
    return (
      <View style={[styles.card, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
        <EmptyState icon={CircleDashed} title={P.unavailable} />
      </View>
    );
  }
  return <SharedDeskCard id={id} view={deskView(reading.value)} />;
}

/** The card itself, from a desk view. */
export function SharedDeskCard({ id, view }: { id: string; view: DeskView }) {
  const { color } = useTheme();
  const preset = view.mandate?.preset ? presetById(view.mandate.preset) : null;
  const symbols = view.mandate ? view.mandate.targets.tokens.map((t) => t.symbol) : view.holdings.map((h) => h.symbol);
  const latest = view.wire.latest;
  const tone = latest ? TONE[latest.outcome] : null;
  const line = view.series.map((p) => dollars(p.totalE6));
  return (
    <Pressable
      onPress={() => router.push(`/desk/${id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${P.kicker}: ${preset?.name ?? DESK.visitorTitle}. ${P.open}`}
      style={({ pressed }) => [styles.card, { borderColor: pressed ? color.inkMuted : color.hairline, backgroundColor: color.surface1 }]}
    >
      <Wash id="en-preview" kind="corner" color={color.accentWash} fade={0.6} />
      <View style={styles.head}>
        {preset ? <AssetDisc asset={preset.basket} size={44} /> : <LogoStack symbols={symbols} size={28} />}
        <View style={styles.name}>
          <Text style={[styles.kicker, { color: color.inkMuted }]}>{P.kicker}</Text>
          <Text style={[styles.nameText, { color: color.ink }]}>{preset?.name ?? DESK.visitorTitle}</Text>
        </View>
        <StatusDot tone={view.isLive ? "live" : "practice"} label={DESK.modes[view.mode]} />
      </View>
      <View style={styles.value}>
        <Text style={[styles.kicker, { color: color.inkMuted }]}>{P.total}</Text>
        <Text style={[styles.figure, { color: color.ink }]}>{view.plate.totalE6 !== null ? usd(view.plate.totalE6) : "—"}</Text>
        {line.length > 1 ? (
          <View style={styles.spark}>
            <Sparkline values={line} width={320} height={48} />
          </View>
        ) : null}
      </View>
      {symbols.length > 0 ? <LogoStack symbols={symbols} size={20} max={8} /> : null}
      {latest && tone ? (
        <View style={[styles.latest, { backgroundColor: color.surface2 }]}>
          <Text style={[styles.kicker, { color: color.inkMuted }]}>
            {P.latest} · {ago(latest.decidedAtSec, view.wire.nowSec)}
          </Text>
          <Text style={[styles.verdict, { color: verdictInk(tone, color) }]}>{RECORD.outcome[latest.outcome]}</Text>
          <Text style={[styles.summary, { color: color.ink }]} numberOfLines={3}>
            {latest.summary}
          </Text>
        </View>
      ) : null}
      <View>
        <DashedRule />
        <View style={styles.foot}>
          <Text style={[styles.footText, { color: color.inkSecondary }]}>{P.checks(latest?.seq ?? 0)}</Text>
          <View style={styles.open}>
            <Text style={[styles.openText, { color: color.accent }]}>{P.open}</Text>
            <ArrowUpRight size={15} color={color.accent} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 20, borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  name: { flex: 1, gap: 2, minWidth: 0 },
  kicker: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 1.26, textTransform: "uppercase" },
  nameText: { fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 28.8 },
  value: { gap: 4 },
  figure: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 37.8, letterSpacing: -1.08, fontVariant: ["tabular-nums"] },
  spark: { marginTop: 6, overflow: "hidden" },
  latest: { gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  verdict: { fontFamily: FONT.dataStrong, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.88, textTransform: "uppercase" },
  summary: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19.575 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12 },
  footText: { flexShrink: 1, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  open: { flexDirection: "row", alignItems: "center", gap: 4 },
  openText: { fontFamily: FONT.bodyStrong, fontSize: 12.5, lineHeight: 20 },
});
