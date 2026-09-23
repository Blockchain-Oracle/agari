import { collateralOrNull } from "@agari/markets";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Side } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTicketComposer } from "@/features/markets/ticket/useTicketComposer";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { TICKET } from "@/lib/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { CallReceipt } from "~/components/ticket/CallReceipt";
import { QuickChips } from "~/components/ticket/QuickChips";
import { ReadoutStrip } from "~/components/ticket/ReadoutStrip";
import { SideToggle } from "~/components/ticket/SideToggle";
import { TicketCta } from "~/components/ticket/TicketCta";
import { AmountPad } from "~/components/ui/AmountPad";
import { FONT, SPACE, TYPE, useTheme } from "~/theme";
import type { EventMarket } from "@agari/core/types";

/** The Ticket as a sheet over the Window: web's composer (useTicketComposer) drawn natively, stake-first. */
export default function TicketSheet() {
  const { color } = useTheme();
  const { m, dir } = useLocalSearchParams<{ m: string; dir?: Side }>();
  const reading = useMarket(m as MarketId);
  const market = reading && isOk(reading) ? reading.value : null;
  if (!market) return <View style={[styles.fill, { backgroundColor: color.ground }]} />;
  return <Composer market={market} side={dir ?? null} />;
}

function Composer({ market, side }: { market: EventMarket; side: Side | null }) {
  const { color } = useTheme();
  const nowMs = useChainNowMs();
  const [sessionId] = useState(() => Date.now());
  const c = useTicketComposer({ marketId: market.marketId, side, market, nowMs, resolving: false, sessionId });
  const symbol = collateralOrNull()?.symbol ?? "tUSDC";

  if (c.booked) {
    return (
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body}>
        <CallReceipt booked={c.booked} market={c.market} decimals={c.decimals} symbol={symbol} onAnother={c.reset} />
      </ScrollView>
    );
  }

  const amount = c.t.stakeText === "" ? "0" : c.t.stakeText;
  return (
    <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <AssetDisc asset={c.market.asset} size={26} />
        <Text style={[TYPE.title, { color: color.ink }]}>{c.market.asset}</Text>
      </View>
      <SideToggle side={c.side} onSelect={c.t.selectSide} />
      <Text style={[styles.amount, { color: c.t.stakeText ? color.ink : color.inkMuted }]} accessibilityLabel={`${amount} ${symbol}`}>
        {amount}
        <Text style={[styles.unit, { color: color.inkMuted }]}> {symbol}</Text>
      </Text>
      <QuickChips availableBase={c.availableBase} decimals={c.decimals} onPick={c.t.setStakeBase} />
      <ReadoutStrip cells={c.strip.cells} live={c.strip.live} caption={c.strip.caption} chance={c.strip.chance} />
      <AmountPad value={c.t.stakeText} onChange={c.t.setStakeText} />
      <AccountLine connected={c.session.isConnected} onConnect={c.session.connect} />
      <TicketCta blocker={c.blocker} ctx={c.ctx} side={c.side} costBase={c.displayed?.maxCostBase ?? null} decimals={c.decimals} symbol={symbol} onConfirm={c.place} />
      <Text style={[TYPE.caption, styles.foot, { color: color.inkMuted }]}>{TICKET.footnote}</Text>
    </ScrollView>
  );
}

/** web's AccountGate, reduced to its two phone actions: connect first, or add funds. */
function AccountLine({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={connected ? () => router.push("/funds") : onConnect} accessibilityRole="link" style={styles.account}>
      <Text style={[TYPE.caption, { color: color.accent }]}>{connected ? "Add funds" : "Connect a wallet to trade"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SPACE.gutter, paddingTop: 22, gap: 14, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  amount: { fontFamily: FONT.dataStrong, fontSize: 48, textAlign: "center", fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.data, fontSize: 18 },
  account: { alignSelf: "center" },
  foot: { textAlign: "center" },
});
