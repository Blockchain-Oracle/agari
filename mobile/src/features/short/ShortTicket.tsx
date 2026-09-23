import { BPS_PER_X, type LeverageReserveState } from "@agari/core/leverage";
import type { EventMarket } from "@agari/core/types";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SHORT } from "@/features/short/copy";
import { isLiveWindow, opensAt } from "@/features/short/useShortWindows";
import { Button, Card, ConnectGate } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { nameOfAsset } from "./assets";
import type { ReviewRequest } from "./ReviewSheet";
import { ShortSizer } from "./ShortSizer";

interface ShortTicketProps {
  market: EventMarket | null;
  nowMs: number;
  reserve: LeverageReserveState;
  symbol: string;
  walletBase: bigint | null;
  onReview: (request: ReviewRequest) => void;
}

/**
 * web's `features/short/ShortTicket.tsx`: connect first; no Window, say so; a Window that opens later names when and
 * offers the plain Down call; a trading one mounts the sizer. `owner_open` requires `leverage_bps > 1×`, so the
 * multiples start at 2× and stop at the reserve's own ceiling.
 */
export function ShortTicket({ market, nowMs, reserve, symbol, walletBase, onReview }: ShortTicketProps) {
  const { color } = useTheme();
  const { ticket } = SHORT;
  const maxMultiple = Math.floor(reserve.params.maxLeverageBps / BPS_PER_X);
  const multiples = useMemo(() => Array.from({ length: Math.max(0, maxMultiple - 1) }, (_, i) => i + 2), [maxMultiple]);
  const [multiple, setMultiple] = useState(2);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const first = multiples[0];
    if (first !== undefined && !multiples.includes(multiple)) setMultiple(first);
  }, [multiples, multiple]);

  if (!market) {
    return (
      <ConnectGate why={ticket.connect}>
        <Card>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{ticket.pickWindow}</Text>
        </Card>
      </ConnectGate>
    );
  }
  if (!isLiveWindow(market, nowMs)) {
    return (
      <ConnectGate why={ticket.connect}>
        <Card>
          <View style={[styles.opensIcon, { backgroundColor: color.surface2 }]}>
            <SymbolView name={{ ios: "calendar.badge.clock", android: "calendar_clock" }} size={20} tintColor={color.inkSecondary} />
          </View>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{ticket.opensTitle(nameOfAsset(market.asset), opensAt(market.tradingStartSec))}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{ticket.opensBody}</Text>
          <Button
            label={ticket.scheduleDown}
            variant="secondary"
            onPress={() => router.push(`/markets/${market.marketId}?dir=down`)}
          />
        </Card>
      </ConnectGate>
    );
  }
  return (
    <ConnectGate why={ticket.connect}>
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
        onReview={onReview}
      />
    </ConnectGate>
  );
}

const styles = StyleSheet.create({
  opensIcon: { width: 40, height: 40, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" },
});
