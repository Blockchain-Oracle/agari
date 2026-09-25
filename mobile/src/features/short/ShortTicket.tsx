import { BPS_PER_X, type LeverageReserveState } from "@agari/core/leverage";
import type { EventMarket } from "@agari/core/types";
import { router } from "expo-router";
import { CalendarClock } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SHORT } from "@/features/short/copy";
import { isLiveWindow, opensAt } from "@/features/short/useShortWindows";
import { FONT, useTheme } from "~/theme";
import { nameOfAsset } from "./assets";
import { ConnectButton } from "./PageParts";
import { usePanelStyle } from "./ShortPicker";
import { ShortSizer } from "./ShortSizer";

interface ShortTicketProps {
  market: EventMarket | null;
  nowMs: number;
  reserve: LeverageReserveState;
  symbol: string;
  walletBase: bigint | null;
  connected: boolean;
}

/**
 * web's `features/short/ShortTicket.tsx`: connect first (the mono line over the Connect button); no Window, say so; a
 * Window that opens later names when and offers the plain Down call; a trading one mounts the sizer. `owner_open`
 * requires `leverage_bps > 1×`, so the multiples start at 2× and stop at the reserve's own ceiling.
 */
export function ShortTicket({ market, nowMs, reserve, symbol, walletBase, connected }: ShortTicketProps) {
  const { color } = useTheme();
  const panel = usePanelStyle();
  const { ticket } = SHORT;
  const maxMultiple = Math.floor(reserve.params.maxLeverageBps / BPS_PER_X);
  const multiples = useMemo(() => Array.from({ length: Math.max(0, maxMultiple - 1) }, (_, i) => i + 2), [maxMultiple]);
  const [multiple, setMultiple] = useState(2);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const first = multiples[0];
    if (first !== undefined && !multiples.includes(multiple)) setMultiple(first);
  }, [multiples, multiple]);

  if (!connected) {
    return (
      <View style={panel}>
        <Text style={[styles.connectT, { color: color.inkMuted }]}>{ticket.connect}</Text>
        <ConnectButton />
      </View>
    );
  }
  if (!market) {
    return (
      <View style={panel}>
        <Text style={[styles.note, { color: color.inkMuted }]}>{ticket.pickWindow}</Text>
      </View>
    );
  }
  if (!isLiveWindow(market, nowMs)) {
    return (
      <View style={[panel, styles.opens]}>
        <View style={[styles.opensIcon, { backgroundColor: color.accentWash }]}>
          <CalendarClock size={20} color={color.accent} />
        </View>
        <Text style={[styles.opensT, { color: color.ink }]}>{ticket.opensTitle(nameOfAsset(market.asset), opensAt(market.tradingStartSec))}</Text>
        <Text style={[styles.opensD, { color: color.inkSecondary }]}>{ticket.opensBody}</Text>
        <Pressable
          onPress={() => router.push(`/markets/${market.marketId}?dir=down`)}
          accessibilityRole="link"
          style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? color.accentPressed : color.accent, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
        >
          <Text style={[styles.ctaText, { color: color.onAccent }]}>{ticket.scheduleDown}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <ShortSizer
      market={market}
      reserve={reserve}
      symbol={symbol}
      walletBase={walletBase}
      multiples={multiples}
      multiple={multiple}
      onMultiple={setMultiple}
      amount={amount}
      onAmount={setAmount}
    />
  );
}

const styles = StyleSheet.create({
  connectT: { marginBottom: 16, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16, textAlign: "center" },
  note: { marginTop: 12, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  opens: { alignItems: "flex-start", gap: 10 },
  opensIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  opensT: { fontFamily: FONT.headingHeavy, fontSize: 17, lineHeight: 21.25, letterSpacing: -0.17 },
  opensD: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  cta: { alignSelf: "stretch", marginTop: 16, paddingVertical: 14, borderRadius: 9999, alignItems: "center" },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 16, lineHeight: 24, textAlign: "center" },
});
