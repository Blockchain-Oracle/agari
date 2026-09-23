import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { classifyRangeBand } from "@agari/core/range";
import { useLeverageShares, useMakerShares, useMyParlays, useMyRanges, useParlayShares, useRangeShares } from "@agari/markets/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** Each reserve holds its own positions. These stakes are shown separately from wallet and Trading Balance funds. */
export function ProductPositions({ address, decimals, symbol }: { address: Address; decimals: number | null; symbol: string }) {
  const { color } = useTheme();
  const parlays = useMyParlays(address);
  const ranges = useMyRanges(address);
  const makerShares = useMakerShares(address);
  const leverageShares = useLeverageShares(address);
  const parlayShares = useParlayShares(address);
  const rangeShares = useRangeShares(address);
  const parlayRows = parlays && isOk(parlays) ? parlays.value : [];
  const rangeRows = ranges && isOk(ranges) ? ranges.value : [];
  const activeParlays = parlayRows.filter((row) => row.status === "live");
  const activeRanges = rangeRows.filter((row) => row.status === "live" && classifyRangeBand(row.openingPrint, row.lowPrint, row.highPrint).kind === "range");
  const activeMoonshots = rangeRows.filter((row) => row.status === "live" && classifyRangeBand(row.openingPrint, row.lowPrint, row.highPrint).kind === "moonshot");
  const claimParlays = parlayRows.filter((row) => row.status === "won").length;
  const claimRanges = rangeRows.filter((row) => row.status === "won" && classifyRangeBand(row.openingPrint, row.lowPrint, row.highPrint).kind === "range").length;
  const claimMoonshots = rangeRows.filter((row) => row.status === "won" && classifyRangeBand(row.openingPrint, row.lowPrint, row.highPrint).kind === "moonshot").length;
  const money = (base: bigint) => decimals === null ? "amount unavailable" : `${formatBaseUnits(base, decimals, { maxDp: 2 })} ${symbol}`;
  const staked = (rows: readonly { stakeBase: bigint }[]) => rows.reduce((sum, row) => sum + row.stakeBase, 0n);
  const providers = [makerShares, leverageShares, parlayShares, rangeShares];
  const earnReady = providers.every((reading) => reading !== null && reading.ok);
  const earnFailed = providers.some((reading) => reading !== null && !reading.ok);
  const earnWorth = earnReady ? providers.reduce((sum, reading) => sum + (reading && isOk(reading) ? reading.value.worthBase : 0n), 0n) : null;

  return <View style={styles.group}>
    <Text style={[TYPE.caption, { color: color.inkSecondary }]}>Positions in product reserves are separate from wallet funds and Window holdings. Open stake is the amount put at risk, not a current valuation.</Text>
    <Row title="Parlay" detail={parlays === null ? "Reading tickets…" : !parlays.ok ? "Ticket read failed" : `${activeParlays.length} live · ${money(staked(activeParlays))} staked${claimParlays ? ` · ${claimParlays} won to claim` : ""}`} path="/parlay" />
    <Row title="Range" detail={ranges === null ? "Reading rounds…" : !ranges.ok ? "Round read failed" : `${activeRanges.length} live · ${money(staked(activeRanges))} staked${claimRanges ? ` · ${claimRanges} won to claim` : ""}`} path="/games/range" />
    <Row title="Moonshot" detail={ranges === null ? "Reading rounds…" : !ranges.ok ? "Round read failed" : `${activeMoonshots.length} live · ${money(staked(activeMoonshots))} staked${claimMoonshots ? ` · ${claimMoonshots} won to claim` : ""}`} path="/games/moonshot" />
    <Row title="Earn reserves" detail={earnFailed ? "Provider balance read failed" : earnWorth === null ? "Reading provider shares…" : `${money(earnWorth)} current share worth · separate from wallet and trading balance`} path="/earn" />
  </View>;
}

function Row({ title, detail, path }: { title: string; detail: string; path: "/short" | "/parlay" | "/games/range" | "/games/moonshot" | "/earn" }) {
  const { color } = useTheme();
  return <Pressable onPress={() => router.push(path as never)} accessibilityRole="link" style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
    <View style={styles.copy}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{title}</Text><Text style={[TYPE.caption, { color: color.inkSecondary }]}>{detail}</Text></View>
    <Text style={[TYPE.bodyStrong, { color: color.accent }]}>→</Text>
  </Pressable>;
}

const styles = StyleSheet.create({ group: { gap: 9 }, row: { minHeight: 66, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }, copy: { flex: 1, gap: 3 } });
