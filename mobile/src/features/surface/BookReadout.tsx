import { phase } from "@agari/core/lifecycle";
import { neededMove } from "@agari/core/market";
import type { BookStructure } from "@agari/core/surface";
import type { EventMarket } from "@agari/core/types";
import { bpsToOddsCents } from "@agari/core/units";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { SURFACE } from "@/features/surface/copy";
import { centsText, pctOfText } from "@/features/surface/format";
import { HERO } from "@/lib/copy";
import { FONT, useTheme } from "~/theme";
import { surfaceTokens } from "~/theme/web/explore/surface";
import { Countdown, MONO, oraclePriceText } from "./parts";

interface Props {
  market: EventMarket;
  structure: BookStructure | null;
  hydrating: boolean;
  openingRaw: bigint | null;
  spotRaw: bigint | null;
  nowMs: number;
}

const price = (bps: number) => `${bpsToOddsCents(bps)}¢`;

/** `.sf-tile`: the mono key, the 19 px Sora figure (web's ≤640 face) and the line that says where it came from. */
function Tile({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  return (
    <View style={[styles.tile, { backgroundColor: t.boxFill, borderColor: t.boxBorder }]}>
      <Text style={[styles.k, { color: color.inkMuted }]}>{label}</Text>
      {typeof value === "string" ? <Text style={[styles.v, { color: color.ink }]} numberOfLines={1}>{value}</Text> : value}
      <Text style={[styles.sub, { color: color.inkMuted }]}>{sub}</Text>
    </View>
  );
}

function OpeningTile({ asset, openingRaw, spotRaw }: { asset: string; openingRaw: bigint | null; spotRaw: bigint | null }) {
  const { color } = useTheme();
  const { tiles } = SURFACE;
  let sub: string = tiles.noSpot;
  if (openingRaw !== null && spotRaw !== null) {
    const move = neededMove(spotRaw, openingRaw);
    sub = `${tiles.spot(oraclePriceText(spotRaw, asset))} · ${tiles.leading(SIDE_WORD[move.leading])}`;
  } else if (spotRaw !== null) sub = tiles.spot(oraclePriceText(spotRaw, asset));
  const value = openingRaw === null ? <Text style={[styles.v, styles.pending, { color: color.inkMuted }]}>{tiles.pendingPrint}</Text> : oraclePriceText(openingRaw, asset);
  return <Tile label={tiles.opening} value={value} sub={sub} />;
}

function UpTile({ structure, hydrating }: { structure: BookStructure | null; hydrating: boolean }) {
  const { tiles } = SURFACE;
  if (!structure) return <Tile label={tiles.up.none} value={hydrating ? tiles.hydrating : "—"} sub={hydrating ? SURFACE.reading : tiles.empty} />;
  const { upAskBps: ask, upBidBps: bid, midBps: mid } = structure;
  if (mid !== null && ask !== null && bid !== null) return <Tile label={tiles.up.mid} value={price(mid)} sub={tiles.bidAsk(price(bid), price(ask))} />;
  if (structure.crossed && ask !== null && bid !== null) return <Tile label={tiles.up.ask} value={price(ask)} sub={tiles.crossedUp(price(bid), price(ask))} />;
  if (ask !== null) return <Tile label={tiles.up.ask} value={price(ask)} sub={tiles.noBids(price(ask))} />;
  if (bid !== null) return <Tile label={tiles.up.bid} value={price(bid)} sub={tiles.noAsks(price(bid))} />;
  return <Tile label={tiles.up.none} value="—" sub={tiles.empty} />;
}

function SpreadTile({ structure, hydrating }: { structure: BookStructure | null; hydrating: boolean }) {
  const { color } = useTheme();
  const { tiles } = SURFACE;
  if (!structure) return <Tile label={tiles.spread} value={hydrating ? tiles.hydrating : "—"} sub={hydrating ? SURFACE.reading : tiles.empty} />;
  if (structure.crossed) return <Tile label={tiles.spread} value={<Text style={[styles.v, styles.word, { color: color.accent }]}>{tiles.crossed}</Text>} sub={tiles.crossedWhy} />;
  if (structure.spreadBps === null || structure.midBps === null) return <Tile label={tiles.spread} value="—" sub={structure.levels === 0 ? tiles.empty : tiles.oneSided} />;
  return <Tile label={tiles.spread} value={centsText(structure.spreadBps)} sub={tiles.spreadOfMid(pctOfText(structure.spreadBps, structure.midBps))} />;
}

/** web's BookReadout (§01): the opening print, the UP price, the spread and the clock, two across on a phone. */
export function BookReadout({ market, structure, hydrating, openingRaw, spotRaw, nowMs }: Props) {
  const { color } = useTheme();
  const word = nowMs > 0 ? HERO.phase[phase(market, nowMs)] : "";
  return (
    <View style={styles.tiles}>
      <OpeningTile asset={market.asset} openingRaw={openingRaw} spotRaw={spotRaw} />
      <UpTile structure={structure} hydrating={hydrating} />
      <SpreadTile structure={structure} hydrating={hydrating} />
      <Tile label={SURFACE.tiles.close} value={<Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} style={[styles.v, { color: color.ink }]} />} sub={word} />
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, minWidth: 0, padding: 14, borderWidth: 1, borderRadius: 4 },
  k: { fontFamily: MONO, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },
  v: { fontFamily: FONT.headingHeavy, fontSize: 19, lineHeight: 26, letterSpacing: -0.475, fontVariant: ["tabular-nums"] },
  pending: { fontFamily: MONO, fontSize: 12, letterSpacing: 0 },
  word: { fontSize: 18, letterSpacing: 0 },
  sub: { fontFamily: MONO, fontSize: 10, lineHeight: 16, marginTop: 8, minHeight: 14 },
});
