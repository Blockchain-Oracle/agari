import { sharePriceRawOf } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import { oneUnit } from "@agari/core/units";
import { useLeverageReserve, useMakerVault, useParlayReserve, useRangeReserve } from "@agari/markets/react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatSharePrice } from "@/features/earn/format";
import { VAULT } from "@/features/vault/copy";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { go } from "../go";

interface Moved {
  label: string;
  price: string;
  since: string;
}

/** web `IdleYieldNote` (A-2a, Q-005; vault.css `.vault-idle`): idle money earns nothing here, and what each reserve's share price has already done. */
export function IdleYieldNote({ idleBase, decimals }: { idleBase: bigint; decimals: number }) {
  const t = usePortfolioTokens();
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
    <View style={[styles.idle, { borderTopColor: t.idleLine }]}>
      <Text style={[styles.head, { color: t.idleHead }]}>{idleBase > 0n ? words.idle : words.empty}</Text>
      <Text style={[styles.body, { color: t.idleBody }]}>{words.mainnetOnly}</Text>
      {moved.length > 0 ? (
        <>
          <Text style={[styles.body, { color: t.idleBody }]}>{words.hereInstead}</Text>
          <View style={styles.rows}>
            {moved.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={[styles.dt, { color: t.idleBody }]}>{row.label}</Text>
                <Text style={[styles.dd, { color: t.idleValue }]}>
                  <Text style={styles.num}>{row.price}</Text> {row.since}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <Pressable onPress={() => go("/earn")} accessibilityRole="link" style={styles.linkWrap} hitSlop={8}>
        <Text style={[styles.link, { color: t.vermilion }]}>{words.cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  idle: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, gap: 8 },
  head: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  body: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  rows: { gap: 4, marginVertical: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  dt: { fontFamily: FONT.dataRegular, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase" },
  dd: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  num: { fontVariant: ["tabular-nums"] },
  linkWrap: { alignSelf: "flex-start", marginTop: 4 },
  link: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32, textTransform: "uppercase" },
});
