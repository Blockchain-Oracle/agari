import { basketMembersHeld, isBasketCoverable, type Basket } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { basketHolding, heldSymbols, tradingBasketWindow } from "@/features/baskets/basket-window";
import { bpsPct, windowText } from "@/features/hedge/calm";
import { useHoldings } from "@/features/hedge/useHoldings";
import { basisRaw, feedRawToOracleRaw, pointsLine } from "@/features/markets/hero/units";
import { assetSourceLabel } from "@/features/markets/price-source/source-label";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { usePreIpoFacts } from "@/features/ticker-hub/usePreIpoFacts";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic } from "~/components/kit";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { MarketCard } from "~/features/markets/board/MarketCard";
import { FONT, useTheme } from "~/theme";
import { BasketMembers } from "./BasketMembers";
import { SourceCaption, Stat, StatBar } from "./HubParts";

const USD_DP = 6;
const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

/** hedge.css `.ys-action`: Cover (Down, vermilion) and Add (Up) as mono caps links into the ticket. */
function HoldAction({ label, down, onPress }: { label: string; down: boolean; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="link"
      hitSlop={8}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      <Text style={[styles.action, { color: down ? color.accent : color.inkSecondary }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * web's `BasketHub` + `BasketHubView` (features/ticker-hub/BasketHub.tsx): Index · Members · Moved over the source
 * caption, 01 the members table, 02 the live basket Window (its lane card) or the quiet line, and "You hold N of M"
 * with Cover (Down) and Add (Up) into the Ticket.
 */
export function BasketHub({ basket }: { basket: Basket }) {
  const { color } = useTheme();
  const B = TICKER_HUB.basket;
  const price = useAssetPrice(basket.symbol);
  const facts = usePreIpoFacts(basket.symbol);
  const venue = useVenue();
  const lanes = useLanes(venue.venueId);
  const nowMs = useChainNowMs();
  const { address } = useWalletSession();
  const holdings = useHoldings(address);

  const laneSet = lanes?.ok ? lanes.value : null;
  const live = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  const factsRow = facts?.ok ? facts.value : null;
  const indexRaw = live ?? factsRow?.indexE8 ?? null;
  const indexStale = price?.ok === true && price.stale;
  const window = tradingBasketWindow(laneSet, basket.symbol, nowMs);
  const held = holdings?.ok ? heldSymbols(holdings.value) : null;
  const holding = holdings?.ok ? basketHolding(basket, holdings.value) : null;
  const heldMembers = held ? basketMembersHeld(basket, held) : [];
  const coverable = held ? isBasketCoverable(basket, held) : false;
  const move = factsRow?.move ?? null;
  const value = holding?.valueUsdE6 == null ? null : `$${formatBaseUnits(holding.valueUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
  const holdLine = held === null ? B.hold.connect : heldMembers.length === 0 ? B.hold.none(basket.members.length) : B.hold.some(heldMembers.length, basket.members.length, value);
  const openTicket = (dir: "up" | "down") => {
    if (window) router.push({ pathname: "/ticket", params: { m: window.marketId, dir } });
  };

  return (
    <>
      <StatBar foot={<SourceCaption label={assetSourceLabel(basket.symbol, null)} tail={B.source} />}>
        <Stat label={indexStale ? `${B.index} · ${TICKER_HUB.spotStale}` : B.index} value={indexRaw === null ? TICKER_HUB.dash : pointsLine(indexRaw)} />
        <Stat label={B.members} value={B.membersLine(basket.members.length)} />
        <Stat label={B.moved(move ? windowText(move.windowSec) : "")} value={move ? B.movedLine(bpsPct(move.rangeBps), signedPct(move.changeBps)) : B.quiet} long />
      </StatBar>

      <SectionHeader index="01" title={B.table.title} style={styles.head} />
      <BasketMembers basket={basket} members={factsRow?.members ?? null} held={held} />

      <SectionHeader index="02" title={B.window.title} style={styles.head} />
      {window ? (
        <View style={styles.window}>
          <MarketCard market={window} nowMs={nowMs} />
        </View>
      ) : (
        <Text style={[styles.quiet, { color: color.inkDisabled }]}>{B.window.none}</Text>
      )}
      <View style={styles.hold}>
        <Text style={[styles.holdLine, { color: color.ink }]}>{holdLine}</Text>
        {held !== null && heldMembers.length > 0 ? (
          window ? (
            <View style={styles.actions}>
              {coverable ? <HoldAction label={B.hold.cover} down onPress={() => openTicket("down")} /> : <Text style={[styles.caption, { color: color.inkMuted }]}>{B.hold.coverNeeds}</Text>}
              <HoldAction label={B.hold.add} down={false} onPress={() => openTicket("up")} />
            </View>
          ) : (
            <Text style={[styles.caption, { color: color.inkMuted }]}>{B.hold.noWindow}</Text>
          )
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 48 },
  window: { marginTop: 24 },
  quiet: { marginTop: 64, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  hold: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 16 },
  holdLine: { flexGrow: 1, flexBasis: 240, fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
});
