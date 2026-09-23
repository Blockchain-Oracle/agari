import { formatCadence } from "@agari/core/copy";
import type { MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { useNextWindow } from "@agari/markets/react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { HERO } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { Button } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** Phases in which this Window takes no more calls, and the ticket should point onward rather than just refuse. */
const OVER: ReadonlySet<MarketPhase> = new Set<MarketPhase>(["locked", "settledUnclaimed", "finalized", "voided"]);

/**
 * A Window that no longer takes calls says so, and offers its successor in the same lane (core `nextWindow`) — the
 * ticket never dead-ends on a closed Window. Nothing renders while the Window still trades.
 */
export function NextWindowOffer({ market, phase }: { market: EventMarket; phase: MarketPhase | null }) {
  const { color } = useTheme();
  const when = useWhen();
  const over = phase !== null && OVER.has(phase);
  const next = useNextWindow(over ? market : null);
  if (!over || !phase) return null;
  const successor = next?.ok ? next.value : null;
  return (
    <View style={[styles.box, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityRole="alert">
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{HERO.phase[phase]}</Text>
      {successor ? (
        <Button
          label={`Next ${formatCadence(successor.intervalSec)} Window · opens ${when(successor.tradingStartSec, { clock: true })}`}
          size="sm"
          icon={{ ios: "arrow.forward.circle", android: "arrow_circle_right" }}
          onPress={() => router.setParams({ m: successor.marketId })}
        />
      ) : (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{next === null ? "Looking for the next Window…" : "The next Window lists when the venue rolls it."}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, gap: 10 },
});
