import { formatSeasonCountdown, seasonRemainingMs, type PrizeTier } from "@agari/core/games";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import type { SeasonView } from "@/features/games/duel/useSeason";
import { FONT, useTheme } from "~/theme";
import { TrophyMark } from "../shell/PixelArt";
import { Foot, Key, Plate } from "./parts";

/**
 * The season pieces of web's ladder: the banner (`SeasonBanner.tsx`), the per-rank prize panel with what the pool
 * escrows on chain, and the prize chip on a rung — lit when the player is eligible, muted with the floor when not.
 */

export function SeasonStrip({ season }: { season: SeasonView }) {
  const { color } = useTheme();
  const nowMs = useNowMs();
  const remaining = nowMs === 0 ? null : seasonRemainingMs(season, nowMs);
  const words = GAMES.rankPage;
  const pool = words.pool(String(season.prizePool.totalUnits), season.prizePool.currency);
  return (
    <View style={[styles.banner, { backgroundColor: color.surface1, borderColor: color.accentDim }]} accessible accessibilityLabel={`${season.name}: ${pool}`}>
      <TrophyMark size={52} />
      <View style={styles.bannerText}>
        <Text style={[styles.eyebrow, { color: color.accent }]}>{GAMES.seasonBanner.eyebrow.toUpperCase()}</Text>
        <Text style={[styles.name, { color: color.ink }]}>{season.name}</Text>
        <Text style={[styles.line, { color: color.inkSecondary }]}>
          {pool}
          {remaining !== null ? ` · ${remaining > 0 ? words.endsIn(formatSeasonCountdown(remaining)) : words.ended}` : ""}
        </Text>
      </View>
    </View>
  );
}

export function PrizePanel({ season }: { season: SeasonView }) {
  const { color } = useTheme();
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
    <Plate>
      <View style={styles.head}>
        <Key>{words.prizes(season.name)}</Key>
        <Text style={[styles.total, { color: color.ink }]}>
          {prizePool.totalUnits} {prizePool.currency}
        </Text>
      </View>
      {prizeSplit.map((tier: PrizeTier) => (
        <View key={`${tier.rankStart}-${tier.rankEnd}`} style={[styles.prizeRow, { borderTopColor: color.hairline }]}>
          <Text style={[styles.rank, { color: tier.rankStart <= 3 && tier.rankStart === tier.rankEnd ? color.accent : color.inkSecondary }]}>
            {tier.rankStart === tier.rankEnd ? words.ordinal(tier.rankStart) : `${words.ordinal(tier.rankStart)}–${words.ordinal(tier.rankEnd)}`}
          </Text>
          <Text style={[styles.amount, { color: color.ink }]}>
            {tier.amountUnits} {prizePool.currency}
            {tier.rankStart !== tier.rankEnd ? ` ${words.each}` : ""}
          </Text>
        </View>
      ))}
      <Foot>
        {words.eligible(minStakedDuels)} · {eligibilityNote}
      </Foot>
      <Foot>
        {escrowLine}
        {escrow && !escrow.distributed ? ` · ${shortHex(escrow.address, 6, 4)}` : ""}
      </Foot>
    </Plate>
  );
}

export function PrizeChip({ prize, season, row }: { prize: number; season: SeasonView; row: { eligible: boolean; stakedDuels: number } }) {
  const { color } = useTheme();
  const words = GAMES.rankPage;
  return (
    <View style={[styles.chip, { backgroundColor: row.eligible ? color.accentWash : color.surface2 }]}>
      <Text style={[styles.chipText, { color: row.eligible ? color.accent : color.inkMuted }]}>
        {words.prize(prize, season.prizePool.currency)}
        {!row.eligible ? ` · ${words.locked(row.stakedDuels, season.minStakedDuels)}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 14 },
  bannerText: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 2 },
  name: { fontFamily: FONT.heading, fontSize: 18 },
  line: { fontFamily: FONT.data, fontSize: 11 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  total: { fontFamily: FONT.dataStrong, fontSize: 16 },
  prizeRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  rank: { fontFamily: FONT.dataStrong, fontSize: 13 },
  amount: { fontFamily: FONT.data, fontSize: 13 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontFamily: FONT.data, fontSize: 10 },
});
