import { ENTRY_BUFFER_SEC } from "@agari/core/constants";
import { noEntryCutoffSec } from "@agari/core/lifecycle";
import { LAUNCH_TICKERS, TICKERS } from "@agari/core/market";
import { formatBaseUnits, formatUtc, parseDecimalToBaseUnits } from "@agari/core/units";
import { selectXWindow, X_CADENCES, xRefusalCopy, type XAsset } from "@agari/core/x";
import { marketsProvider } from "@agari/markets";
import { useLanes, useTick } from "@agari/markets/react";
import * as Clipboard from "expo-clipboard";
import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { X_HANDLE } from "@/features/x/copy";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import { AmountField, Cadences, Legend, PostPreview, XI } from "./InstructionParts";

type Cadence = keyof typeof X_CADENCES;

/** CSS grid-cols-2 as rows of two; an odd last cell keeps its half width. */
function pairs<T>(list: readonly T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < list.length; i += 2) rows.push([list[i], list[i + 1] ?? null]);
  return rows;
}

/**
 * web's XInstructionBuilder.tsx (`.xi`): asset, direction, timeframe and amount against the relay's exact Window rule,
 * then the cream post preview and "Copy instruction". Copying never sends an order.
 */
export function InstructionBuilder({ enabled, balanceBase, decimals, symbol }: {
  enabled: boolean; balanceBase: bigint | null; decimals: number; symbol: string;
}) {
  const t = tradeXTokens(useTheme().name);
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  useTick(1000);
  const nowMs = marketsProvider.nowMs();
  const markets = lanes?.ok && !lanes.stale ? lanes.value.lanes.flatMap((l) => l.markets) : null;
  const unavailable = Boolean(lanes && (!lanes.ok || lanes.stale));
  const [asset, setAsset] = useState<XAsset>("TSLA");
  const [side, setSide] = useState<"up" | "down">("up");
  const [amount, setAmount] = useState("5");
  const [cadence, setCadence] = useState<Cadence>("5m");
  const [copied, setCopied] = useState("");

  const selection = markets ? selectXWindow(markets, { asset, intervalSec: X_CADENCES[cadence] }, nowMs) : null;
  const stake = parseDecimalToBaseUnits(amount, decimals);
  const amountError = !stake || stake <= 0n ? "Enter a positive amount." : balanceBase !== null && stake > balanceBase
    ? `Your X balance is ${formatBaseUnits(balanceBase, decimals)} ${symbol}. Use a smaller amount or add funds.` : "";
  const instruction = `${X_HANDLE} ${asset} ${side.toUpperCase()} ${amount} ${cadence}`;
  const canCopy = Boolean(enabled && selection?.ok && !amountError);
  const maxAmount = balanceBase === null ? null : formatBaseUnits(balanceBase, decimals, { maxDp: decimals, minDp: 0, group: false });
  const status = selection?.ok ? `Entries close at ${formatUtc(noEntryCutoffSec(selection.market) * 1000, { withSeconds: true })}.`
    : selection ? xRefusalCopy({ refusalCode: selection.code, entryClosesAtSec: selection.market ? noEntryCutoffSec(selection.market) : null,
      nextWindowAtSec: selection.code === "window-not-started" ? selection.market?.tradingStartSec : null }).detail
    : unavailable ? "Live Windows could not be checked. Try again shortly." : "Checking live Windows…";
  const cadences = (Object.entries(X_CADENCES) as [Cadence, number][]).map(([name, intervalSec]) => {
    const w = markets ? selectXWindow(markets, { asset, intervalSec }, nowMs) : null;
    const label = w?.ok ? "Open" : w?.code === "window-not-started" ? "Soon" : w?.code === "opening-price-pending" ? "Starting" : w ? "Closed" : unavailable ? "Unavailable" : "Checking";
    return { name, label, open: Boolean(w?.ok) };
  });
  const copy = async () => {
    if (!canCopy) return;
    try { await Clipboard.setStringAsync(instruction); setCopied(instruction); }
    catch { setCopied("Copy failed. Select the instruction text and copy it."); }
  };

  return (
    <View accessibilityLabel="Build an X instruction">
      <View style={styles.heading}>
        <Text style={[styles.h2, { color: t.ink }]}>Make your call.</Text>
        <Text style={[styles.sub, { color: t.xiMute }]}>Choose. Copy. Post on X.</Text>
      </View>
      <View style={styles.choices}>
        <View>
          <Legend label="Asset" />
          <View style={styles.grid}>
            {pairs(LAUNCH_TICKERS).map((row) => (
            <View key={row.join()} style={styles.pair}>
            {row.map((name) => {
              if (!name) return <View key="spacer" style={styles.cell} />;
              const on = asset === name;
              return (
                <Pressable key={name} onPress={() => setAsset(name)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={name}
                  style={({ pressed }) => [styles.choice, { borderColor: on ? t.xiAssetOn : t.xiLine, backgroundColor: on ? t.xiAssetOn : pressed ? t.xiHover : t.clear }, pressed && styles.down]}>
                  <Text style={[styles.mark, { color: on ? t.xiAssetOnInk : t.ink }]}>{TICKERS[name].monogram}</Text>
                  <View style={styles.shrink}>
                    <Text style={[styles.assetName, { color: on ? t.xiAssetOnInk : t.ink }]}>{name}</Text>
                    <Text style={[styles.small, styles.dim, { color: on ? t.xiAssetOnInk : t.ink }]} numberOfLines={1}>{TICKERS[name].name}</Text>
                  </View>
                  {on ? <Check size={13} color={t.xiAssetOnInk} strokeWidth={2} style={styles.check} /> : null}
                </Pressable>
              );
            })}
            </View>
            ))}
          </View>
        </View>
        <View>
          <Legend label="Direction" />
          <View style={styles.pair}>
            {(["up", "down"] as const).map((s) => {
              const on = side === s;
              const Icon = s === "up" ? ArrowUpRight : ArrowDownRight;
              const ink = on ? (s === "up" ? t.xiUp : t.xiDown) : t.xiMute;
              return (
                <Pressable key={s} onPress={() => setSide(s)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={s === "up" ? "UP / LONG" : "DOWN / SHORT"}
                  style={({ pressed }) => [styles.choice, styles.side, { borderColor: on ? (s === "up" ? t.xiUpBorder : t.xiDownBorder) : t.xiLine, backgroundColor: on ? (s === "up" ? t.xiUpWash : t.xiDownWash) : t.clear }, pressed && styles.down]}>
                  <Icon size={22.5} color={ink} strokeWidth={2} />
                  <View>
                    <Text style={[styles.sideName, { color: ink }]}>{s === "up" ? "UP" : "DOWN"}</Text>
                    <Text style={[styles.small, { color: ink }]}>{s === "up" ? "Long" : "Short"}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.field}>
        <Legend label="Timeframe" aside="Live availability" />
        <Cadences items={cadences} value={cadence} onPick={setCadence} />
        <Text style={[styles.status, { color: selection?.ok ? t.xiUp : t.xiMute }]} accessibilityLiveRegion="polite">{status}</Text>
      </View>
      <View style={styles.field}>
        <Legend label="Amount" aside={`X balance · ${maxAmount ?? "—"} ${symbol}`} />
        <AmountField amount={amount} setAmount={setAmount} symbol={symbol} decimals={decimals} balanceBase={balanceBase} maxAmount={maxAmount} error={amountError} />
      </View>
      <PostPreview side={side} asset={asset} amount={!stake || stake <= 0n ? "…" : amount} cadence={cadence} canCopy={canCopy} copied={copied === instruction} enabled={enabled}
        failed={copied.startsWith("Copy failed") ? copied : ""} onCopy={() => void copy()} />
      <Text style={[styles.timing, { color: t.xiMute }]}>
        Entries close {ENTRY_BUFFER_SEC}s before the Window ends. Post early enough for X delivery; availability is checked again on arrival.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: XI(1.5) },
  h2: { fontFamily: FONT.headingHeavy, fontSize: XI(1.5), lineHeight: XI(1.725), letterSpacing: -0.9 },
  sub: { marginTop: 6, fontFamily: FONT.body, fontSize: XI(0.8125), lineHeight: 19.5 },
  choices: { gap: XI(1.25) },
  grid: { gap: XI(0.5) },
  pair: { flexDirection: "row", gap: XI(0.5) },
  cell: { flex: 1 },
  choice: { flex: 1, flexDirection: "row", alignItems: "center", gap: XI(0.625), minHeight: XI(3.5), paddingVertical: XI(0.65), paddingHorizontal: XI(0.85), borderWidth: 1, borderRadius: XI(0.75) },
  side: { gap: XI(0.5) },
  down: { transform: [{ translateY: 1 }] },
  mark: { width: XI(1.75), fontFamily: FONT.body, fontSize: 15, lineHeight: XI(1.75) },
  shrink: { flexShrink: 1 },
  assetName: { fontFamily: FONT.bodyStrong, fontSize: XI(0.9375), lineHeight: 22.5, letterSpacing: -0.28 },
  sideName: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 24, letterSpacing: -0.375 },
  small: { marginTop: 1.5, fontFamily: FONT.body, fontSize: XI(0.625), lineHeight: 15 },
  dim: { opacity: 0.68 },
  check: { marginLeft: "auto" },
  field: { marginTop: XI(1.5) },
  status: { marginTop: XI(0.7), fontFamily: FONT.body, fontSize: XI(0.6875), lineHeight: 15.47 },
  timing: { marginTop: XI(0.85), fontFamily: FONT.body, fontSize: XI(0.6875), lineHeight: 16.5 },
});
