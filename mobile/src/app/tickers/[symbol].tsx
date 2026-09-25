import { isTickerSymbol } from "@agari/core/market";
import { Redirect, useLocalSearchParams } from "expo-router";
import { TickerHubScreen } from "~/features/ticker-hub/TickerHubScreen";

/**
 * `/tickers/<SYMBOL>` — web's app/tickers/[symbol]/page.tsx: `/tickers/<SYMBOL>` is the one spelling (any other case
 * redirects to it), and an unlisted ticker lands on Markets, as web's not-found redirect does (nothing 404s).
 */
export default function TickerRoute() {
  const { symbol = "" } = useLocalSearchParams<{ symbol: string }>();
  const upper = symbol.toUpperCase();
  if (!isTickerSymbol(upper)) return <Redirect href="/markets" />;
  if (symbol !== upper) return <Redirect href={`/tickers/${upper}`} />;
  return <TickerHubScreen symbol={upper} />;
}
