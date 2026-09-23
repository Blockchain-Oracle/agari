import { basketMembersHeld, isBasketCoverable, type Basket } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
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
import { Button, SectionHeader } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { BasketMembers } from "./BasketMembers";
import { SourceLine, Stat, StatBar } from "./HubParts";
import { WindowCard } from "./WindowCard";

const USD_DP = 6;
const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

/**
 * web's `BasketHub` + `BasketHubView` (features/ticker-hub/BasketHub.tsx): Index · Members · Moved over the source
 * line, the members, the live basket Window, and "You hold N of M" with Cover (Down) and Add (Up) into the Ticket.
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
  const holdLine =
    held === null
      ? B.hold.connect
      : heldMembers.length === 0
        ? B.hold.none(basket.members.length)
        : B.hold.some(heldMembers.length, basket.members.length, value);
  const openTicket = (dir: "up" | "down") => {
    if (window) router.push({ pathname: "/ticket", params: { m: window.marketId, dir } });
  };

  return (
    <>
      <StatBar foot={<SourceLine label={assetSourceLabel(basket.symbol, null)} tail={B.source} />}>
        <Stat label={indexStale ? `${B.index} · ${TICKER_HUB.spotStale}` : B.index} value={indexRaw === null ? TICKER_HUB.dash : pointsLine(indexRaw)} />
        <Stat label={B.members} value={B.membersLine(basket.members.length)} mono={false} />
        <Stat
          label={B.moved(move ? windowText(move.windowSec) : "")}
          value={move ? B.movedLine(bpsPct(move.rangeBps), signedPct(move.changeBps)) : B.quiet}
          long
        />
      </StatBar>

      <SectionHeader index="01" title={B.table.title} />
      <BasketMembers basket={basket} members={factsRow?.members ?? null} held={held} />

      <SectionHeader index="02" title={B.window.title} />
      {window ? (
        <WindowCard market={window} nowMs={nowMs} />
      ) : (
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{B.window.none}</Text>
      )}
      <View style={styles.hold}>
        <Text style={[TYPE.body, { color: color.ink }]}>{holdLine}</Text>
        {held !== null && heldMembers.length > 0 ? (
          window ? (
            <View style={styles.actions}>
              {coverable ? (
                <Button label={B.hold.cover} variant="loss" size="sm" block={false} onPress={() => openTicket("down")} />
              ) : (
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>{B.hold.coverNeeds}</Text>
              )}
              <Button label={B.hold.add} variant="profit" size="sm" block={false} onPress={() => openTicket("up")} />
            </View>
          ) : (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{B.hold.noWindow}</Text>
          )
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hold: { gap: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
});
