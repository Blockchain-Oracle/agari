import { sharePriceRawOf } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import { oneUnit } from "@agari/core/units";
import { useLeverageReserve, useMakerVault, useParlayReserve, useRangeReserve } from "@agari/markets/react";
import { go } from "./go";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatSharePrice } from "@/features/earn/format";
import { VAULT } from "@/features/vault/copy";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { usePlateInk } from "./usePlateInk";

interface Moved {
  label: string;
  price: string;
  since: string;
}

/**
 * web `IdleYieldNote` (A-2a, Q-005): money parked in the Trading Balance earns nothing, the lenders that would pay
 * for it are not on this cluster, and what does pay here is each reserve's share price — what it has already done.
 */
export function IdleYield({ idleBase, decimals }: { idleBase: bigint; decimals: number }) {
  const { color } = useTheme();
  const ink = usePlateInk();
  const maker = useMakerVault();
  const range = useRangeReserve();
  const parlay = useParlayReserve();
  const boost = useLeverageReserve();
  const words = VAULT.idleYield;

  const one = oneUnit(decimals);
  const moved: Moved[] = [];
  const add = (label: string, sharePriceRaw: bigint | null) => {
    if (sharePriceRaw === null) return;
    const delta = sharePriceRaw - one;
    moved.push({ label, price: formatSharePrice(sharePriceRaw, decimals), since: delta === 0n ? words.flat : delta > 0n ? words.up : words.down });
  };
  if (maker && isOk(maker) && maker.value) add(words.maker, maker.value.sharePriceRaw);
  if (range && isOk(range) && range.value) add(words.range, sharePriceRawOf(range.value.totalValueBase, range.value.supplyShares, range.value.decimals));
  if (parlay && isOk(parlay) && parlay.value) add(words.parlay, sharePriceRawOf(parlay.value.totalValueBase, parlay.value.supplyShares, parlay.value.decimals));
  if (boost && isOk(boost) && boost.value) add(words.boost, sharePriceRawOf(boost.value.totalValueBase, boost.value.supplyShares, boost.value.decimals));

  return (
    <View style={[styles.box, { backgroundColor: ink.raised, borderColor: ink.line }]}>
      <Text style={[TYPE.caption, { color: ink.ink }]}>{idleBase > 0n ? words.idle : words.empty}</Text>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{words.mainnetOnly}</Text>
      {moved.length > 0 ? (
        <>
          <Text style={[TYPE.caption, { color: ink.mute }]}>{words.hereInstead}</Text>
          {moved.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={[TYPE.caption, { color: ink.mute }]}>{row.label}</Text>
              <Text style={[styles.price, { color: ink.ink }]}>
                {row.price} <Text style={{ color: ink.mute }}>{row.since}</Text>
              </Text>
            </View>
          ))}
        </>
      ) : null}
      <Pressable onPress={() => go("/earn")} accessibilityRole="link" hitSlop={8}>
        <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{words.cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  price: { fontFamily: FONT.data, fontSize: 13, fontVariant: ["tabular-nums"] },
});
