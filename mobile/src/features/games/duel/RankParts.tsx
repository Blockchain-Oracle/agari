import type { PrizeTier } from "@agari/core/games";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import type { SeasonView } from "@/features/games/duel/useSeason";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { Foot, Key, Plate, useDuelTokens } from "./parts";

/**
 * The ladder's parts from web's `DuelRank.tsx` (duel.css): the rung's place — gold, silver and bronze medallions for
 * the top three as tints of the venue's own inks — the per-rank prize panel with what the pool escrows on chain, and
 * Flicky's `PrizeChip`, lit when the player is eligible, muted with the distance to the floor when not.
 */

/** `.du-rung-place`: mono 12 in a 28 px column; `medal` draws the top three as 28 px radius-8 medallions. */
export function Place({ place, medal }: { place: number | null; medal?: boolean }) {
  const { d, color } = useDuelTokens();
  if (medal && place !== null && place <= 3) {
    const fill = place === 1 ? d.medal1 : place === 2 ? d.medal2 : d.medal3;
    const ink = place === 3 ? d.medal3Ink : d.medalInk;
    return (
      <View style={[styles.medal, { backgroundColor: fill }]}>
        <Text style={[styles.place, styles.medalText, { color: ink }]}>{place}</Text>
      </View>
    );
  }
  return <Text style={[styles.place, styles.plain, { color: color.inkMuted }]}>{place ?? "—"}</Text>;
}

/** `.du-plate.du-prizes`: the season's pool in the pixel face, a row per rank, the eligibility floor and the escrow line. */
export function PrizePanel({ season }: { season: SeasonView }) {
  const { color } = useDuelTokens();
  const words = GAMES.rankPage;
  const { prizeSplit, prizePool, minStakedDuels, eligibilityNote, escrow } = season;
  const escrowLine = !escrow
    ? words.notEscrowed
    : escrow.distributed
      ? words.distributed
      : (() => {
          const have = formatBaseUnits(escrow.balanceBase, escrow.decimals, { maxDp: 2, minDp: 0 });
          const short = escrow.balanceBase < BigInt(prizePool.totalUnits) * 10n ** BigInt(escrow.decimals);
          return short ? words.escrowShort(have, String(prizePool.totalUnits), escrow.symbol) : words.escrowed(have, escrow.symbol);
        })();
  return (
    <Plate style={styles.prizes}>
      <View style={styles.head}>
        <Key>{words.prizes(season.name)}</Key>
        <Text style={[styles.total, { color: color.accent }]}>
          {prizePool.totalUnits} {prizePool.currency}
        </Text>
      </View>
      <View style={styles.list}>
        {prizeSplit.map((tier: PrizeTier) => {
          const medal = tier.rankStart === tier.rankEnd && tier.rankStart <= 3;
          return (
            <View key={`${tier.rankStart}-${tier.rankEnd}`} style={styles.row}>
              <Text style={[styles.rank, { color: medal ? color.ink : color.inkSecondary }]}>
                {(tier.rankStart === tier.rankEnd ? words.ordinal(tier.rankStart) : `${words.ordinal(tier.rankStart)}–${words.ordinal(tier.rankEnd)}`).toUpperCase()}
              </Text>
              <Text style={[styles.amount, { color: color.ink }]}>
                {tier.amountUnits} {prizePool.currency}
                {tier.rankStart !== tier.rankEnd ? <Text style={[styles.each, { color: color.inkMuted }]}> {words.each.toUpperCase()}</Text> : null}
              </Text>
            </View>
          );
        })}
      </View>
      <Foot>
        {words.eligible(minStakedDuels)} · {eligibilityNote}
      </Foot>
      <View style={[styles.escrow, { borderTopColor: color.hairline }]}>
        <Foot>
          {escrowLine}
          {escrow && !escrow.distributed ? ` · ${shortHex(escrow.address, 6, 4)}` : ""}
        </Foot>
      </View>
    </Plate>
  );
}

export function PrizeChip({ prize, season, row }: { prize: number; season: SeasonView; row: { eligible: boolean; stakedDuels: number } }) {
  const { d, color } = useDuelTokens();
  const words = GAMES.rankPage;
  return (
    <View style={[styles.chip, { borderColor: row.eligible ? d.chipOnBorder : d.chipBorder, backgroundColor: row.eligible ? d.chipOnBg : d.chipBg }]}>
      <Text style={[styles.chipText, { color: row.eligible ? color.accent : color.inkMuted }]}>
        {words.prize(prize, season.prizePool.currency).toUpperCase()}
        {!row.eligible ? ` · ${words.locked(row.stakedDuels, season.minStakedDuels).toUpperCase()}` : ""}
      </Text>
    </View>
  );
}

/** `.du-rung` and its parts, shared by the board and the pinned standing. */
export const rungStyles = StyleSheet.create({
  rung: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1 },
  main: { flex: 1, minWidth: 0, gap: 2 },
  side: { alignItems: "flex-end", gap: 2 },
  addr: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6, columnGap: 10 },
  rating: { fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 28.8, fontVariant: ["tabular-nums"] },
});

const styles = StyleSheet.create({
  place: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"] },
  plain: { minWidth: 28 },
  medal: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  medalText: { fontFamily: FONT.dataStrong },
  prizes: { gap: 8, marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  total: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, fontVariant: ["tabular-nums"] },
  list: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rank: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.96 },
  amount: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
  each: { fontSize: 9, letterSpacing: 1.08 },
  escrow: { borderTopWidth: 1, paddingTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", paddingVertical: 1, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1 },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, fontVariant: ["tabular-nums"] },
});
