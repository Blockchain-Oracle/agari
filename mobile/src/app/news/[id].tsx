import { isTickerSymbol } from "@agari/core/market";
import { useLocalSearchParams } from "expo-router";
import { StoryScreen } from "~/features/news/StoryScreen";

/** One wire story: `id` is its place on the wire, `url` finds it in the cached read, `symbol` names which wire. */
export default function StoryRoute() {
  const { id, url, symbol } = useLocalSearchParams<{ id: string; url?: string; symbol?: string }>();
  return <StoryScreen url={url ?? ""} index={id} symbol={isTickerSymbol(symbol ?? null) ? (symbol as never) : null} />;
}
