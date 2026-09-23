import { nameOf, presetById, type DeskMandate } from "@agari/core/desk";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { draftTargets, limitSentences, practiceCashE6, type StudioDraft } from "@/features/desk/draft";
import { usd } from "@/features/desk/format";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { pctLabel } from "@/features/desk/studio/studio-model";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { LogoStack, PartitionBar } from "../kit";
import { mixLabel, slicesOf } from "./slices";

const R = STUDIO.receipt;

/** What you are about to sign (web's studio/Receipt.tsx), on the cream receipt paper: the basket, its split, every limit. */
export function Receipt({ draft, mandate }: { draft: StudioDraft; mandate: DeskMandate }) {
  const { color } = useTheme();
  const ink = color.creamInk;
  const muted = color.inkMuted;
  const targets = draftTargets(draft);
  const preset = draft.preset ? presetById(draft.preset) : null;
  const cash = practiceCashE6(draft);
  const symbols = targets.tokens.map((t) => t.symbol);
  const slices = slicesOf(draft, color).filter((s) => s.value > 0);
  return (
    <View style={[styles.paper, { backgroundColor: color.cream, borderColor: color.creamHairline, shadowColor: color.shadow }]} accessibilityLabel={R.title}>
      <View style={styles.head}>
        {preset ? <AssetDisc asset={preset.basket} size={40} /> : <LogoStack symbols={symbols} size={24} names={symbols.map(nameOf)} />}
        <View style={styles.grow}>
          <Text style={[TYPE.labelMicro, { color: muted }]}>{R.title}</Text>
          <Text style={[TYPE.title, { color: ink }]}>{preset ? preset.name : DESK.studio.side.own}</Text>
        </View>
        <Text style={[TYPE.dataLg, { color: ink }]}>{usd(cash, 0)}</Text>
      </View>
      <View style={[styles.section, { borderTopColor: color.creamHairline }]}>
        <Text style={[TYPE.labelMicro, { color: muted }]}>{R.split}</Text>
        <PartitionBar slices={slices} height={10} label={mixLabel(slices)} />
        {targets.tokens.map((t) => (
          <View key={t.symbol} style={styles.line}>
            <AssetDisc asset={t.symbol} size={20} />
            <Text style={[TYPE.caption, styles.grow, { color: ink }]}>{nameOf(t.symbol)}</Text>
            <Text style={[styles.mono, { color: ink }]}>{pctLabel(t.weightBps)}</Text>
            <Text style={[styles.mono, styles.usd, { color: ink }]}>{usd((cash * BigInt(t.weightBps)) / 10_000n, 0)}</Text>
          </View>
        ))}
        {targets.cashBps > 0 ? (
          <View style={styles.line}>
            <TUsdcMark size={20} />
            <Text style={[TYPE.caption, styles.grow, { color: ink }]}>{DESK.studio.basket.cash}</Text>
            <Text style={[styles.mono, { color: ink }]}>{pctLabel(targets.cashBps)}</Text>
            <Text style={[styles.mono, styles.usd, { color: ink }]}>{usd((cash * BigInt(targets.cashBps)) / 10_000n, 0)}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.section, { borderTopColor: color.creamHairline }]}>
        <Text style={[TYPE.labelMicro, { color: muted }]}>{R.limits}</Text>
        {limitSentences(mandate).map((s) => (
          <View key={s.text} style={styles.limit}>
            <Text style={[TYPE.caption, styles.grow, { color: ink }]}>{s.text}</Text>
            <Text style={[styles.by, { color: s.by === "program" ? color.accent : muted }]}>{s.by === "program" ? STUDIO.strictness.program : STUDIO.strictness.code}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, gap: 12, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1 },
  section: { borderTopWidth: 1, borderStyle: "dashed", paddingTop: 10, gap: 8 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  mono: { fontFamily: FONT.data, fontSize: 13 },
  usd: { minWidth: 56, textAlign: "right" },
  limit: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  by: { fontFamily: FONT.data, fontSize: 10, textAlign: "right", maxWidth: 96 },
});
