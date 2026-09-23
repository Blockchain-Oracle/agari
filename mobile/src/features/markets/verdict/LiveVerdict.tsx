import { SETTLING } from "@agari/core/copy";
import type { MarketId } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useVerdict } from "@/features/markets/verdict/useVerdict";
import { VERDICT_UI } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { ConnectGate, EmptyState, ReadingView } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { VerdictCard } from "./VerdictCard";

const FALLBACK_SYMBOL = "tUSDC";

/**
 * web's LiveVerdict: mounted for a Window at or past its bell. "Settling…" until the chain resolves it, then this
 * wallet's one verdict — stamp, P&L, claim, receipt — or the plain fact that it held nothing there.
 */
export function LiveVerdict({ marketId }: { marketId: MarketId }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const state = useVerdict({ marketId, wallet: address });
  const symbol = collateralOrNull()?.symbol ?? FALLBACK_SYMBOL;

  if (state.phase === "open") return null;
  if (!address) return <ConnectGate why={VERDICT_UI.connect.why} />;
  if (state.phase === "settling") {
    return (
      <View style={[styles.settling, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityLiveRegion="polite">
        <ActivityIndicator color={color.accent} />
        <Text style={[TYPE.body, styles.settlingText, { color: color.inkSecondary }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{SETTLING}</Text> {VERDICT_UI.settling}
        </Text>
      </View>
    );
  }
  return (
    <ReadingView reading={state.market} loading="plate">
      {(market) =>
        market === null ? (
          <EmptyState why={VERDICT_UI.notFound.why} />
        ) : (
          <ReadingView reading={state.verdict} loading="plate">
            {(verdict) =>
              verdict === null ? (
                <EmptyState why={VERDICT_UI.noPosition.why} />
              ) : (
                <VerdictCard key={verdict.marketId} verdict={verdict} market={market} resolution={state.resolution?.ok ? state.resolution.value : null} symbol={symbol} />
              )
            }
          </ReadingView>
        )
      }
    </ReadingView>
  );
}

const styles = StyleSheet.create({
  settling: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  settlingText: { flex: 1 },
});
