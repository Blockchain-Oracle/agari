import { isTickerSymbol } from "@agari/core/market";
import { useLocalSearchParams } from "expo-router";
import { NewsScreen } from "~/features/news/NewsScreen";

/** `/news` (web app/news/page.tsx); `?symbol=TSLA` narrows the wire as it does on web. */
export default function NewsRoute() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  const raw = symbol?.toUpperCase() ?? null;
  return <NewsScreen key={raw ?? "all"} initialSymbol={isTickerSymbol(raw) ? raw : null} />;
}
