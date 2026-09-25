import { BASKET_SYMBOLS, BASKETS, basketMembersHeld, isBasketCoverable, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { Bell, BellRing } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { basketHolding, heldSymbols, tradingBasketWindow } from "@/features/baskets/basket-window";
import { RECORD } from "@/features/desk/copy-record";
import { setBell, useBells } from "~/features/hedge/bells";
import { bpsPct, holdsPreIpo, isCalm, windowText } from "@/features/hedge/calm";
import { HEDGE } from "@/features/hedge/copy";
import { hedgeTarget } from "@/features/hedge/hedge-target";
import { useHoldings, type HoldingView } from "@/features/hedge/useHoldings";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { usePreIpoFactsAll, type PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";
import { useWalletSession } from "@/lib/wallet-session";
import { SectionHeader, usePortfolioTokens } from "~/components/portfolio/web";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
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

/** web `DropBellToggle` (`.ys-bell`): 10 px mono caps at 60 % until it is on; a device-local switch the app rings in-app. */
function BellToggle({ asset }: { asset: TickerSymbol }) {
  const { color } = useTheme();
  const on = useBells().includes(asset);
  const name = TICKERS[asset].name;
  const Icon = on ? BellRing : Bell;
  return (
    <Pressable onPress={() => setBell(asset, !on)} accessibilityRole="switch" accessibilityState={{ checked: on }} hitSlop={6} style={[styles.bell, !on && styles.bellOff]}>
      <Icon size={12} color={color.ink} />
      <Text style={[styles.bellText, { color: color.ink }]}>{on ? HEDGE.bell.on(name) : HEDGE.bell.off(name)}</Text>
    </Pressable>
  );
}

interface RowProps {
  asset: string;
  name: string;
  lines: readonly string[];
  move: string | null;
  bell: TickerSymbol | null;
  calmLine: string | null;
  windowId: string | null;
  cover: string;
  add: string;
  none: string;
}

/** hedge.css `.ys-row` at ≤480 px: the 40 pt mark, the Sora name and the mono lines, then the two text actions under the text column. */
function HoldRow({ asset, name, lines, move, bell, calmLine, windowId, cover, add, none }: RowProps) {
  const { color } = useTheme();
  const t = usePortfolioTokens();
  return (
    <View style={[styles.row, { borderBottomColor: color.hairline }]}>
      <View style={styles.markCol}>
        <AssetDisc asset={asset} size={40} />
      </View>
      <View style={styles.textCol}>
        <View style={styles.text}>
          <Text style={[styles.name, { color: color.ink }]}>{name}</Text>
          {lines.map((l) => (
            <Text key={l} style={[styles.line, { color: color.inkSecondary }]}>
              {l}
            </Text>
          ))}
          {move ? <Text style={[styles.move, { color: color.inkSecondary }]}>{move}</Text> : null}
        </View>
        {bell ? <BellToggle asset={bell} /> : null}
        {calmLine ? (
          <Text style={[styles.action, styles.none, { color: color.inkSecondary }]}>{calmLine}</Text>
        ) : windowId ? (
          <View style={styles.actions}>
            <Pressable onPress={() => openWindow(windowId, "down")} accessibilityRole="link" hitSlop={8}>
              <Text style={[styles.action, { color: t.vermilion }]}>{cover}</Text>
            </Pressable>
            <Pressable onPress={() => openWindow(windowId, "up")} accessibilityRole="link" hitSlop={8}>
              <Text style={[styles.action, { color: color.inkSecondary }]}>{add}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.action, styles.none, { color: color.inkSecondary }]}>{none}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * web `YourStocks` ("01 · Your stocks", plan Step 4): every stock token the wallet holds, read-only, each with both bets
 * offered — cover it with Down, add with Up — or an honest line; then the baskets, "Let a desk hold this basket" and
 * the mono feet. Renders nothing until the holdings read answers, as web.
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
  const foot = (text: string) => <Text style={[styles.foot, { color: color.inkMuted }]}>{text}</Text>;

  return (
    <View style={styles.section}>
      <SectionHeader index={index} title={HEDGE.stocks.title} />
      <Text style={[WEB_TYPE.body, { color: color.inkSecondary }]}>{HEDGE.stocks.intro}</Text>
      {groups.length === 0 ? (
        <Text style={[WEB_TYPE.body, { color: color.inkMuted }]}>{HEDGE.stocks.empty}</Text>
      ) : (
        <View style={[styles.list, { borderTopColor: color.hairline }]}>
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
                lines={[value === null ? tokensText(g.holdings) : `${tokensText(g.holdings)} ≈ ${value}`]}
                move={move && !calm ? HEDGE.stocks.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : null}
                bell={g.underlying}
                calmLine={calm && move ? HEDGE.stocks.calm(TICKERS[g.underlying].name, windowText(move.windowSec)) : null}
                windowId={target?.market.marketId ?? null}
                cover={HEDGE.stocks.cover}
                add={HEDGE.stocks.add}
                none={HEDGE.stocks.none}
              />
            );
          })}
        </View>
      )}
      {groups.length > 0 ? foot(HEDGE.bell.foot) : null}
      {foot(HEDGE.stocks.foot)}
      {baskets.length > 0 || oneOnly ? (
        <View style={styles.baskets}>
          <SectionHeader index="" title={HEDGE.baskets.title} />
          <Text style={[WEB_TYPE.body, { color: color.inkSecondary }]}>{HEDGE.baskets.intro}</Text>
          {oneOnly ? (
            <Text style={[WEB_TYPE.body, { color: color.inkMuted }]}>{HEDGE.baskets.one}</Text>
          ) : (
            <View style={[styles.list, { borderTopColor: color.hairline }]}>
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
                    lines={[`${HEDGE.baskets.holds(own.members.length, basket.members.length, usd(own.valueUsdE6))} · ${tokensText(own.holdings)}`]}
                    move={move && !calm ? HEDGE.stocks.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : null}
                    bell={null}
                    calmLine={calm && move ? HEDGE.baskets.calm(basket.name, windowText(move.windowSec)) : null}
                    windowId={window?.marketId ?? null}
                    cover={HEDGE.baskets.cover}
                    add={HEDGE.baskets.add}
                    none={HEDGE.baskets.none}
                  />
                );
              })}
            </View>
          )}
        </View>
      ) : null}
      {deskBaskets.length > 0 ? (
        <View style={styles.actions}>
          {deskBaskets.map((basket) => (
            <Pressable key={basket.symbol} onPress={() => go("/desk/new", { basket: basket.symbol })} accessibilityRole="link" accessibilityHint={RECORD.hooks.stocks.holdWhy} hitSlop={6}>
              <Text style={[styles.action, { color: color.inkSecondary }]}>
                {RECORD.hooks.stocks.hold} · {basket.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  list: { borderTopWidth: 1 },
  row: { flexDirection: "row", columnGap: 14, paddingVertical: 12, borderBottomWidth: 1 },
  markCol: { justifyContent: "center" },
  textCol: { flex: 1, minWidth: 0 },
  text: { gap: 2 },
  name: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 19.8 },
  line: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.48, fontVariant: ["tabular-nums"] },
  move: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6 },
  bell: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  bellOff: { opacity: 0.6 },
  bellText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  action: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  none: { textTransform: "uppercase" },
  foot: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.36 },
  baskets: { gap: 16, marginTop: 8 },
});
