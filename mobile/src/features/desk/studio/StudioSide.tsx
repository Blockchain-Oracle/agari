import { nameOf, presetById, type DeskMandate } from "@agari/core/desk";
import { Check, CircleDashed, RefreshCw } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { draftTargets, practiceCashE6, type StudioDraft } from "@/features/desk/draft";
import { usd } from "@/features/desk/format";
import { pctLabel } from "@/features/desk/studio/studio-model";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { Donut, StatusDot } from "../kit";
import { CashDisc, StLabel, T } from "./kit-bits";
import { mixLabel, segColor, slicesOf } from "./slices";

const S = DESK.studio.side;

/** Display only: a share of the practice balance as whole dollars. */
const share = (cashE6: bigint, bps: number): string => `$${Math.round(Number((cashE6 * BigInt(bps)) / 10_000n) / 1_000_000).toLocaleString("en-US")}`;

/** One `.st-side-rows` line: the colour bar, the mark, the name, the share and its dollars. */
function SideRow({ tint, mark, label, bps, cash }: { tint: string; mark: ReactNode; label: string; bps: number; cash: bigint }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: tint }]} />
      {mark}
      <Text style={[styles.label, { color: color.ink }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.pct, { color: color.inkMuted }]}>{pctLabel(bps)}</Text>
      <Text style={[styles.usd, { color: color.ink }]}>{share(cash, bps)}</Text>
    </View>
  );
}

/** A `.dk-row`: the name left, the value right, a hairline above all but the first. */
function DkRow({ name, first, children }: { name: string; first?: boolean; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.dkRow, !first && { borderTopWidth: 1, borderTopColor: color.hairline }]}>
      <Text style={[styles.dkRowText, { color: color.inkSecondary }]}>{name}</Text>
      {children}
    </View>
  );
}

/**
 * web's StudioSide.tsx: the mix as a ring with the practice balance in the middle, one row per company with its logo,
 * share and dollars, then the money limits, the mode and the test read's standing. It follows every edit.
 */
export function StudioSide({ draft, mandate, read }: { draft: StudioDraft; mandate: DeskMandate | null; read: "done" | "stale" | "none" }) {
  const { color } = useTheme();
  const targets = draftTargets(draft);
  const preset = draft.preset ? presetById(draft.preset) : null;
  const cash = practiceCashE6(draft);
  const slices = slicesOf(draft, color).filter((s) => s.value > 0);
  const readInk = read === "done" ? color.profit : read === "stale" ? color.warning : color.ink;
  const ReadIcon = read === "done" ? Check : read === "stale" ? RefreshCw : CircleDashed;
  return (
    <View style={[styles.side, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={S.kicker}>
      <StLabel>{S.kicker}</StLabel>
      <View style={styles.head}>
        {preset ? <AssetDisc asset={preset.basket} size={36} /> : null}
        <Text style={[styles.name, { color: color.ink }]}>{preset ? S.preset(preset.name) : S.own}</Text>
      </View>
      <View style={styles.ring}>
        <Donut slices={slices} size={168} thickness={12} label={mixLabel(slices)}>
          <Text style={[styles.total, { color: color.ink }]}>{usd(cash, 0)}</Text>
          <Text style={[styles.caption, { color: color.inkMuted }]}>{DESK.modes.practice}</Text>
        </Donut>
      </View>
      <View style={styles.rows}>
        {targets.tokens.map((t) => (
          <SideRow key={t.symbol} tint={segColor(t.symbol, color)} mark={<AssetDisc asset={t.symbol} size={22} />} label={nameOf(t.symbol)} bps={t.weightBps} cash={cash} />
        ))}
        {targets.cashBps > 0 ? <SideRow tint={color.inkMuted} mark={<CashDisc size={22} />} label={DESK.studio.basket.cash} bps={targets.cashBps} cash={cash} /> : null}
      </View>
      <View>
        <DkRow name={S.perAction} first>
          <Text style={[styles.dkRowValue, { color: color.ink }]}>{mandate ? usd(mandate.perActionCapE6, 0) : "—"}</Text>
        </DkRow>
        <DkRow name={S.daily}>
          <Text style={[styles.dkRowValue, { color: color.ink }]}>{mandate ? usd(mandate.dailyCapE6, 0) : "—"}</Text>
        </DkRow>
        <DkRow name={S.mode}>
          <StatusDot tone="practice" label={DESK.modes.practice} />
        </DkRow>
        <DkRow name={S.read}>
          <View style={styles.read}>
            <ReadIcon size={14} color={readInk} />
            <Text style={[styles.dkRowValue, { color: readInk }]}>{read === "done" ? S.readDone : read === "stale" ? S.readStale : S.readNone}</Text>
          </View>
        </DkRow>
      </View>
      <Text style={[T.caption, { color: color.inkMuted }]}>{S.approach}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { gap: 12, padding: 18, borderWidth: 1, borderRadius: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 17, lineHeight: 27.2, letterSpacing: -0.17 },
  ring: { alignItems: "center", paddingVertical: 4 },
  total: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 38.4, letterSpacing: -0.48 },
  caption: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  rows: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { width: 4, height: 18, borderRadius: 2 },
  label: { flex: 1, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  pct: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  usd: { minWidth: 56, textAlign: "right", fontFamily: FONT.dataStrong, fontSize: 12.5, lineHeight: 20 },
  dkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  dkRowText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  dkRowValue: { fontFamily: FONT.bodyMedium, fontSize: 13, lineHeight: 20.8 },
  read: { flexDirection: "row", alignItems: "center", gap: 6 },
});
