import { nameOf, presetById, type DeskMandate } from "@agari/core/desk";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { draftTargets, limitSentences, practiceCashE6, type StudioDraft } from "@/features/desk/draft";
import { usd } from "@/features/desk/format";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { pctLabel } from "@/features/desk/studio/studio-model";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { LogoStack, PartitionBar } from "../kit";
import { CashDisc, DashedRule, StBy, StLabel, Wash } from "./kit-bits";
import { mixLabel, slicesOf } from "./slices";

const R = STUDIO.receipt;

/** A `.st-receipt-split` line: the mark, the name, the share and its dollars. */
function SplitRow({ mark, name, bps, amount }: { mark: ReactNode; name: string; bps: number; amount: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.split}>
      {mark}
      <Text style={[styles.splitName, { color: color.ink }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.splitPct, { color: color.inkSecondary }]}>{pctLabel(bps)}</Text>
      <Text style={[styles.splitUsd, { color: color.ink }]}>{amount}</Text>
    </View>
  );
}

/** web's studio/Receipt.tsx: what you are about to sign — the basket with its logos and split, every limit and who enforces it. */
export function Receipt({ draft, mandate }: { draft: StudioDraft; mandate: DeskMandate }) {
  const { color } = useTheme();
  const targets = draftTargets(draft);
  const preset = draft.preset ? presetById(draft.preset) : null;
  const cash = practiceCashE6(draft);
  const symbols = targets.tokens.map((t) => t.symbol);
  const slices = slicesOf(draft, color).filter((s) => s.value > 0);
  return (
    <View style={[styles.receipt, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityLabel={R.title}>
      <Wash id="st-receipt" kind="top" color={color.accentWash} fade={0.4} />
      <View style={styles.head}>
        {preset ? <AssetDisc asset={preset.basket} size={36} /> : <LogoStack symbols={symbols} size={28} names={symbols.map(nameOf)} />}
        <View>
          <StLabel>{R.title}</StLabel>
          <Text style={[styles.name, { color: color.ink }]}>{preset ? preset.name : DESK.studio.side.own}</Text>
        </View>
        <Text style={[styles.cash, { color: color.ink }]}>{usd(cash, 0)}</Text>
      </View>
      <View style={styles.section}>
        <DashedRule style={styles.rule} />
        <StLabel>{R.split}</StLabel>
        <PartitionBar slices={slices} height={10} label={mixLabel(slices)} />
        <View style={styles.list}>
          {targets.tokens.map((t) => (
            <SplitRow key={t.symbol} mark={<AssetDisc asset={t.symbol} size={22} />} name={nameOf(t.symbol)} bps={t.weightBps} amount={usd((cash * BigInt(t.weightBps)) / 10_000n, 0)} />
          ))}
          {targets.cashBps > 0 ? <SplitRow mark={<CashDisc size={22} />} name={DESK.studio.basket.cash} bps={targets.cashBps} amount={usd((cash * BigInt(targets.cashBps)) / 10_000n, 0)} /> : null}
        </View>
      </View>
      <View style={styles.section}>
        <DashedRule style={styles.rule} />
        <StLabel>{R.limits}</StLabel>
        <View style={styles.list}>
          {limitSentences(mandate).map((s) => (
            <View key={s.text} style={styles.limit}>
              <Text style={[styles.limitText, { color: color.ink }]}>{s.text}</Text>
              <StBy by={s.by} text={s.by === "program" ? STUDIO.strictness.program : STUDIO.strictness.code} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: { gap: 18, padding: 20, borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 17, lineHeight: 27.2, letterSpacing: -0.17 },
  cash: { marginLeft: "auto", fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 38.4, letterSpacing: -0.48 },
  section: { gap: 10, paddingTop: 16 },
  rule: { position: "absolute", top: 0, left: 0, right: 0 },
  list: { gap: 8 },
  split: { flexDirection: "row", alignItems: "center", gap: 10 },
  splitName: { flex: 1, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20.25 },
  splitPct: { fontFamily: FONT.dataStrong, fontSize: 13.5, lineHeight: 20.25 },
  splitUsd: { width: 64, textAlign: "right", fontFamily: FONT.dataStrong, fontSize: 13.5, lineHeight: 20.25 },
  limit: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  limitText: { flexShrink: 1, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20.25 },
});
