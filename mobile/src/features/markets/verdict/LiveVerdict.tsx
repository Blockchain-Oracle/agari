import { SETTLING } from "@agari/core/copy";
import type { MarketId } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text } from "react-native";
import { useVerdict } from "@/features/markets/verdict/useVerdict";
import { VERDICT_UI } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { ReadingView } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { WordsEmptyState } from "../words/parts";
import { VerdictCard } from "./VerdictCard";

const FALLBACK_SYMBOL = "";

/**
 * web's LiveVerdict: mounted for a Window at or past its bell. "Settling…" as a plain line until the chain resolves it,
 * then this wallet's one verdict — stamp, P&L, claim, receipt — or web's empty state saying why there is none.
 */
export function LiveVerdict({ marketId }: { marketId: MarketId }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const state = useVerdict({ marketId, wallet: address });
  const symbol = collateralOrNull()?.symbol ?? FALLBACK_SYMBOL;
  const queryClient = useQueryClient();
  const retry = () => void queryClient.invalidateQueries();

  if (state.phase === "open") return null;
  if (!address) return <WordsEmptyState why={VERDICT_UI.connect.why} />;
  if (state.phase === "settling") {
    return (
      <Text style={[styles.body, { color: color.inkSecondary }]} accessibilityLiveRegion="polite">
        <Text style={[styles.strong, { color: color.ink }]}>{SETTLING}</Text> {VERDICT_UI.settling}
      </Text>
    );
  }
  return (
    <ReadingView reading={state.market} loading="plate" retry={retry}>
      {(market) =>
        market === null ? (
          <WordsEmptyState why={VERDICT_UI.notFound.why} />
        ) : (
          <ReadingView reading={state.verdict} loading="plate" retry={retry}>
            {(verdict) =>
              verdict === null ? (
                <WordsEmptyState why={VERDICT_UI.noPosition.why} />
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
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  strong: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23.25 },
});
