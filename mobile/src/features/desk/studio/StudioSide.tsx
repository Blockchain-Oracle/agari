import { nameOf, presetById, type DeskMandate } from "@agari/core/desk";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { draftTargets, practiceCashE6, type StudioDraft } from "@/features/desk/draft";
import { usd } from "@/features/desk/format";
import { pctLabel } from "@/features/desk/studio/studio-model";
import { Row, Rows } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { FONT, TYPE, useTheme } from "~/theme";
import { Donut, Panel, segColor, StatusDot } from "../kit";
import { mixLabel, slicesOf } from "./slices";

const S = DESK.studio.side;

/**
 * The studio's side card (web's StudioSide.tsx), under the step on a phone: the mix as a ring with the practice
 * balance in the middle, a row per company with its share and dollars, the money limits, the mode, the read's standing.
 */
export function StudioSide({ draft, mandate, read }: { draft: StudioDraft; mandate: DeskMandate | null; read: "done" | "stale" | "none" }) {
  const { color } = useTheme();
  const targets = draftTargets(draft);
  const preset = draft.preset ? presetById(draft.preset) : null;
  const cash = practiceCashE6(draft);
  const slices = slicesOf(draft, color).filter((s) => s.value > 0);
  const share = (bps: number) => usd((cash * BigInt(bps)) / 10_000n, 0);
  const readIcon: SymbolViewProps["name"] = read === "done" ? { ios: "checkmark", android: "check" } : read === "stale" ? { ios: "arrow.triangle.2.circlepath", android: "sync" } : { ios: "circle.dashed", android: "radio_button_unchecked" };
  return (
    <Panel title={S.kicker}>
      <View style={styles.head}>
        {preset ? <AssetDisc asset={preset.basket} size={32} /> : null}
        <Text style={[TYPE.title, { color: color.ink }]}>{preset ? S.preset(preset.name) : S.own}</Text>
      </View>
      <View style={styles.ring}>
        <Donut slices={slices} size={140} thickness={11} label={mixLabel(slices)}>
          <Text style={[styles.total, { color: color.ink }]}>{usd(cash, 0)}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK.modes.practice}</Text>
        </Donut>
      </View>
      {targets.tokens.map((t) => (
        <View key={t.symbol} style={styles.line}>
          <View style={[styles.dot, { backgroundColor: segColor(t.symbol, color) }]} />
          <AssetDisc asset={t.symbol} size={20} />
          <Text style={[TYPE.caption, styles.grow, { color: color.ink }]}>{nameOf(t.symbol)}</Text>
          <Text style={[TYPE.data, { color: color.inkSecondary }]}>{pctLabel(t.weightBps)}</Text>
          <Text style={[TYPE.data, styles.usd, { color: color.ink }]}>{share(t.weightBps)}</Text>
        </View>
      ))}
      {targets.cashBps > 0 ? (
        <View style={styles.line}>
          <View style={[styles.dot, { backgroundColor: color.inkMuted }]} />
          <TUsdcMark size={20} />
          <Text style={[TYPE.caption, styles.grow, { color: color.ink }]}>{DESK.studio.basket.cash}</Text>
          <Text style={[TYPE.data, { color: color.inkSecondary }]}>{pctLabel(targets.cashBps)}</Text>
          <Text style={[TYPE.data, styles.usd, { color: color.ink }]}>{share(targets.cashBps)}</Text>
        </View>
      ) : null}
      <Rows>
        <Row label={S.perAction} value={mandate ? usd(mandate.perActionCapE6, 0) : "—"} />
        <Row label={S.daily} value={mandate ? usd(mandate.dailyCapE6, 0) : "—"} />
        <Row label={S.mode} value={<StatusDot tone="practice" label={DESK.modes.practice} />} />
        <Row
          label={S.read}
          value={
            <View style={styles.read}>
              <SymbolView name={readIcon} size={12} tintColor={read === "done" ? color.profit : read === "stale" ? color.warning : color.inkMuted} />
              <Text style={[TYPE.caption, { color: read === "done" ? color.profit : read === "stale" ? color.warning : color.inkMuted }]}>{read === "done" ? S.readDone : read === "stale" ? S.readStale : S.readNone}</Text>
            </View>
          }
        />
      </Rows>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{S.approach}</Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  ring: { alignItems: "center", paddingVertical: 4 },
  total: { fontFamily: FONT.dataStrong, fontSize: 18 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  grow: { flex: 1 },
  usd: { minWidth: 60, textAlign: "right" },
  read: { flexDirection: "row", alignItems: "center", gap: 4 },
});
