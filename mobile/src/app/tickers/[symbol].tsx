import { isTickerSymbol } from "@agari/core/market";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { EmptyState, Screen } from "~/components/kit";
import { TickerHubScreen } from "~/features/ticker-hub/TickerHubScreen";

/**
 * `/tickers/<SYMBOL>` — web's app/tickers/[symbol]/page.tsx: `/tickers/<SYMBOL>` is the one spelling (any other case
 * redirects to it), and an unlisted ticker says so.
 */
export default function TickerRoute() {
  const { symbol = "" } = useLocalSearchParams<{ symbol: string }>();
  const upper = symbol.toUpperCase();
  if (!isTickerSymbol(upper)) {
    return (
      <Screen title="Ticker">
        <EmptyState
          why={`$${upper} isn't a ticker Agari lists.`}
          detail="Every listed stock, pre-IPO name and basket is on the Markets tab."
          action={{ label: "Open Markets", onPress: () => router.replace("/markets") }}
        />
      </Screen>
    );
  }
  if (symbol !== upper) return <Redirect href={`/tickers/${upper}`} />;
  return <TickerHubScreen symbol={upper} />;
}
