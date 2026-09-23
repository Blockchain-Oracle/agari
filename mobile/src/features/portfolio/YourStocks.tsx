import { BASKET_SYMBOLS, BASKETS, basketMembersHeld, isBasketCoverable, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { basketHolding, heldSymbols, tradingBasketWindow } from "@/features/baskets/basket-window";
import { RECORD } from "@/features/desk/copy-record";
import { bpsPct, holdsPreIpo, isCalm, windowText } from "@/features/hedge/calm";
import { HEDGE } from "@/features/hedge/copy";
import { hedgeTarget } from "@/features/hedge/hedge-target";
import { useHoldings, type HoldingView } from "@/features/hedge/useHoldings";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { usePreIpoFactsAll, type PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, SectionHeader } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { go } from "./go";

const SHARES_DP = 8;
const SHARES_SHOWN_DP = 4;
const USD_DP = 6;

interface Group {
  underlying: TickerSymbol;
  holdings: HoldingView[];
  valueUsdE6: bigint | null;
}

/** web `groupHoldings`: holdings by the company they track; a group's value is null if any token in it is unpriced. */
function groupHoldings(holdings: readonly HoldingView[]): Group[] {
  const groups = new Map<TickerSymbol, HoldingView[]>();
  for (const h of holdings) groups.set(h.underlying, [...(groups.get(h.underlying) ?? []), h]);
  return [...groups].map(([underlying, list]) => ({
    underlying,
    holdings: list,
    valueUsdE6: list.every((h) => h.exposureUsdE6 !== null) ? list.reduce((sum, h) => sum + (h.exposureUsdE6 ?? 0n), 0n) : null,
  }));
}

const tokensText = (list: readonly HoldingView[]) => list.map((h) => `${formatBaseUnits(h.sharesE8, SHARES_DP, { maxDp: SHARES_SHOWN_DP, minDp: 0 })} ${h.symbol}`).join(" + ");
const usd = (e6: bigint | null) => (e6 === null ? null : `$${formatBaseUnits(e6, USD_DP, { maxDp: 0, minDp: 0 })}`);
const openWindow = (marketId: string, dir: "up" | "down") => router.push({ pathname: "/markets/[id]", params: { id: marketId, dir } });

/** One holding (or basket) row: the disc, the name (opens its ticker page), what is held, then both bets or the reason. */
function HoldRow({ asset, name, line, move, calmLine, windowId, cover, add, none }: {
  asset: string; name: string; line: string; move: string | null; calmLine: string | null; windowId: string | null; cover: string; add: string; none: string;
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: color.hairline }]}>
      <Pressable onPress={() => go("/tickers/[symbol]", { symbol: asset })} accessibilityRole="link" accessibilityLabel={`${name}: ${line}`} style={styles.head}>
        <AssetDisc asset={asset} size={36} />
        <View style={styles.flex}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{name}</Text>
          <Text style={[TYPE.data, { color: color.inkSecondary }]}>{line}</Text>
          {move ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{move}</Text> : null}
        </View>
      </Pressable>
      {calmLine ? (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{calmLine}</Text>
      ) : windowId ? (
        <View style={styles.actions}>
          <Button label={cover} variant="loss" size="sm" style={styles.flex} onPress={() => openWindow(windowId, "down")} />
          <Button label={add} variant="profit" size="sm" style={styles.flex} onPress={() => openWindow(windowId, "up")} />
        </View>
      ) : (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{none}</Text>
      )}
    </View>
  );
}

/**
 * web `YourStocks` ("01 · Your stocks", plan Step 4): every stock token the wallet holds, read-only, each with both
 * Agari bets offered — cover it with Down, add with Up — on the Window the cover card would pick, or an honest line;
 * a name that has barely moved is told so instead of offered a Down bet (D-100). Then the baskets two held members
 * sit in, and "Let a desk hold this basket". Renders nothing until the holdings read answers, as web.
 */
export function YourStocks({ index }: { index: string }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const venue = useVenue();
  const lanes = useLanes(venue.venueId);
  const nowMs = useChainNowMs();
  const facts = usePreIpoFactsAll(holdings?.ok === true && holdsPreIpo(holdings.value));
  if (!holdings?.ok) return null;

  const laneSet: LaneSet | null = lanes && lanes.ok ? lanes.value : null;
  const movement: Record<string, PreIpoMove | null> = facts?.ok ? Object.fromEntries(Object.entries(facts.value).map(([s, row]) => [s, row.move ?? null])) : {};
  const groups = groupHoldings(holdings.value);
  const held = heldSymbols(holdings.value);
  const baskets = BASKET_SYMBOLS.map((s) => BASKETS[s]).filter((b) => isBasketCoverable(b, held));
  const oneOnly = baskets.length === 0 && BASKET_SYMBOLS.some((s) => basketMembersHeld(BASKETS[s], held).length === 1);
  const deskBaskets = BASKET_SYMBOLS.map((s) => BASKETS[s]).filter((b) => basketMembersHeld(b, held).length >= 1);

  return (
    <View style={styles.section}>
      <SectionHeader index={index} title={HEDGE.stocks.title} desc={HEDGE.stocks.intro} />
      {groups.length === 0 ? <Text style={[TYPE.body, { color: color.inkMuted }]}>{HEDGE.stocks.empty}</Text> : null}
      {groups.map((g) => {
        const move = movement[g.underlying] ?? null;
        const calm = isCalm(move);
        const value = usd(g.valueUsdE6);
        const target = hedgeTarget(laneSet, g.underlying, nowMs);
        return (
          <HoldRow
            key={g.underlying}
            asset={g.underlying}
            name={TICKERS[g.underlying].name}
            line={value === null ? tokensText(g.holdings) : `${tokensText(g.holdings)} ≈ ${value}`}
            move={move && !calm ? HEDGE.stocks.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : null}
            calmLine={calm && move ? HEDGE.stocks.calm(TICKERS[g.underlying].name, windowText(move.windowSec)) : null}
            windowId={target?.market.marketId ?? null}
            cover={HEDGE.stocks.cover}
            add={HEDGE.stocks.add}
            none={HEDGE.stocks.none}
          />
        );
      })}
      {baskets.length > 0 || oneOnly ? (
        <View style={styles.sub}>
          <SectionHeader title={HEDGE.baskets.title} desc={HEDGE.baskets.intro} />
          {oneOnly ? <Text style={[TYPE.body, { color: color.inkMuted }]}>{HEDGE.baskets.one}</Text> : null}
          {baskets.map((basket) => {
            const own = basketHolding(basket, holdings.value);
            const window = tradingBasketWindow(laneSet, basket.symbol, nowMs);
            const move = movement[basket.symbol] ?? null;
            const calm = isCalm(move);
            return (
              <HoldRow
                key={basket.symbol}
                asset={basket.symbol}
                name={basket.name}
                line={`${HEDGE.baskets.holds(own.members.length, basket.members.length, usd(own.valueUsdE6))} · ${tokensText(own.holdings)}`}
                move={move && !calm ? HEDGE.stocks.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : null}
                calmLine={calm && move ? HEDGE.baskets.calm(basket.name, windowText(move.windowSec)) : null}
                windowId={window?.marketId ?? null}
                cover={HEDGE.baskets.cover}
                add={HEDGE.baskets.add}
                none={HEDGE.baskets.none}
              />
            );
          })}
        </View>
      ) : null}
      {deskBaskets.map((basket) => (
        <Button key={basket.symbol} label={`${RECORD.hooks.stocks.hold} · ${basket.name}`} variant="outline" size="sm" accessibilityHint={RECORD.hooks.stocks.holdWhy} onPress={() => go("/desk/new", { basket: basket.symbol })} />
      ))}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{HEDGE.stocks.foot}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  sub: { gap: 10, marginTop: 4 },
  row: { gap: 10, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.sm },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: 8 },
});
