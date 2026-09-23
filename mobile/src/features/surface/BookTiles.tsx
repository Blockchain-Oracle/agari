import { phase } from "@agari/core/lifecycle";
import { neededMove } from "@agari/core/market";
import type { BookStructure } from "@agari/core/surface";
import type { EventMarket } from "@agari/core/types";
import { bpsToOddsCents } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { SURFACE } from "@/features/surface/copy";
import { centsText, pctOfText } from "@/features/surface/format";
import { HERO } from "@/lib/copy";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { clockText, oraclePriceText } from "./parts";

// 21st: makviesainte/progress-metric-card — a label, one large figure, the sentence that says where it came from.
function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  const { color } = useTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: accent ? color.accentWash : color.surface1, borderColor: accent ? color.accentDim : color.hairline }]}
      accessible
      accessibilityLabel={`${label}: ${value}. ${sub}`}
    >
      <Text style={[styles.label, { color: accent ? color.accent : color.inkMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={3}>
        {sub}
      </Text>
    </View>
  );
}

const price = (bps: number) => `${bpsToOddsCents(bps)}¢`;

function upTile(structure: BookStructure | null, hydrating: boolean): { label: string; value: string; sub: string } {
  const { tiles } = SURFACE;
  if (!structure) return { label: tiles.up.none, value: hydrating ? tiles.hydrating : "—", sub: hydrating ? SURFACE.reading : tiles.empty };
  const { upAskBps: ask, upBidBps: bid, midBps: mid } = structure;
  if (mid !== null && ask !== null && bid !== null) return { label: tiles.up.mid, value: price(mid), sub: tiles.bidAsk(price(bid), price(ask)) };
  if (structure.crossed && ask !== null && bid !== null) return { label: tiles.up.ask, value: price(ask), sub: tiles.crossedUp(price(bid), price(ask)) };
  if (ask !== null) return { label: tiles.up.ask, value: price(ask), sub: tiles.noBids(price(ask)) };
  if (bid !== null) return { label: tiles.up.bid, value: price(bid), sub: tiles.noAsks(price(bid)) };
  return { label: tiles.up.none, value: "—", sub: tiles.empty };
}

function spreadTile(structure: BookStructure | null, hydrating: boolean): { value: string; sub: string } {
  const { tiles } = SURFACE;
  if (!structure) return { value: hydrating ? tiles.hydrating : "—", sub: hydrating ? SURFACE.reading : tiles.empty };
  if (structure.crossed) return { value: tiles.crossed, sub: tiles.crossedWhy };
  if (structure.spreadBps === null || structure.midBps === null) return { value: "—", sub: structure.levels === 0 ? tiles.empty : tiles.oneSided };
  return { value: centsText(structure.spreadBps), sub: tiles.spreadOfMid(pctOfText(structure.spreadBps, structure.midBps)) };
}

/**
 * web's `BookReadout` (features/surface/BookReadout.tsx): four tiles two by two — the opening print (with spot and who
 * is winning), the UP price, the spread, and the clock with the Window's phase.
 */
export function BookTiles({ market, structure, hydrating, openingRaw, spotRaw, nowMs }: {
  market: EventMarket;
  structure: BookStructure | null;
  hydrating: boolean;
  openingRaw: bigint | null;
  spotRaw: bigint | null;
  nowMs: number;
}) {
  const { tiles } = SURFACE;
  let openingSub: string = tiles.noSpot;
  if (openingRaw !== null && spotRaw !== null) {
    const move = neededMove(spotRaw, openingRaw);
    openingSub = `${tiles.spot(oraclePriceText(spotRaw, market.asset))} · ${tiles.leading(SIDE_WORD[move.leading])}`;
  } else if (spotRaw !== null) {
    openingSub = tiles.spot(oraclePriceText(spotRaw, market.asset));
  }
  const up = upTile(structure, hydrating);
  const spread = spreadTile(structure, hydrating);
  return (
    <View style={styles.grid}>
      <Tile label={tiles.opening} value={openingRaw === null ? tiles.pendingPrint : oraclePriceText(openingRaw, market.asset)} sub={openingSub} />
      <Tile label={up.label} value={up.value} sub={up.sub} accent />
      <Tile label={tiles.spread} value={spread.value} sub={spread.sub} />
      <Tile label={tiles.close} value={clockText(market.expirySec, nowMs)} sub={nowMs > 0 ? HERO.phase[phase(market, nowMs)] : ""} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47%", flexGrow: 1, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  label: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase" },
  value: { fontFamily: FONT.dataStrong, fontSize: 22, lineHeight: 27 },
});
