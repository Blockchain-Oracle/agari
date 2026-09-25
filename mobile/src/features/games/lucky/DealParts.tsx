import type { Side } from "@agari/core/types";
import { StyleSheet, Text } from "react-native";
import { Press } from "~/features/games/frame";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { Band, useLuckyTokens } from "./parts";

/** `.st-band.lk-cell`: one figure of the live quote — the pixel key over the pixel value, "—" until quoted. */
export function QuoteCell({ k, v, live }: { k: string; v: string | null; live?: boolean }) {
  const { color } = useLuckyTokens();
  const ink = v === null ? color.inkMuted : live ? color.accent : color.ink;
  return (
    <Band style={styles.cell}>
      <Text style={[styles.k, { color: color.inkMuted }]} numberOfLines={1}>
        {k.toUpperCase()}
      </Text>
      <Text style={[styles.v, { color: ink }]} numberOfLines={1}>
        {v ?? "—"}
      </Text>
    </Band>
  );
}

/**
 * web's `BlockedButton` at size lg in the dealt side's tone: "Place UP · 1.02 tUSDC" in the profit or loss fill with
 * cream ink; while blocked, the blocker IS the label, on surface-2 in the disabled ink, and it does nothing.
 */
export function PlaceButton({ blocked, side, label, money, symbol, onPress }: { blocked: string | null; side: Side; label: string; money: string | null; symbol: string; onPress: () => void }) {
  const { lk, color } = useLuckyTokens();
  if (blocked) {
    return (
      <Press disabled accessibilityRole="button" accessibilityLabel={blocked} accessibilityState={{ disabled: true }} style={[styles.btn, { backgroundColor: color.surface2, borderColor: color.hairline }]}>
        <Text style={[styles.label, { color: color.inkDisabled }]} numberOfLines={1}>
          {blocked}
        </Text>
      </Press>
    );
  }
  return (
    <Press onPress={onPress} accessibilityRole="button" style={[styles.btn, { backgroundColor: side === "up" ? color.profit : color.loss, borderColor: "transparent" }]}>
      <Text style={[styles.label, { color: lk.toneInk }]} numberOfLines={1}>
        {label}
        {money !== null ? (
          <>
            {" "}
            <Text style={styles.num}>{money}</Text>
            <Text style={{ color: color.inkSecondary }}> {symbol}</Text>
          </>
        ) : null}
      </Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  cell: { flexGrow: 1, flexBasis: "30%", minWidth: 0, gap: 2, paddingVertical: 6, paddingHorizontal: 10 },
  k: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.98 },
  v: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, fontVariant: ["tabular-nums"] },
  btn: { height: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: FONT.bodyMedium, fontSize: 16, lineHeight: 24 },
  num: { fontVariant: ["tabular-nums"] },
});
