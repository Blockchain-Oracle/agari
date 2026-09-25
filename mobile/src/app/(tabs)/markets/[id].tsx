import { isMarketId } from "@agari/core/types";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { MarketsScreen } from "~/features/markets/MarketsScreen";

/**
 * `/markets/<id>` — web's app/markets/[id]/page.tsx: the shareable address of one Window renders the same page as
 * /markets with that Window in the hero (the deep link resolves it, a dead Window to its successor with a note); a
 * mistyped id lands on /markets.
 */
export default function MarketRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isMarketId(id)) return <Redirect href="/markets" />;
  return (
    <>
      <Stack.Screen options={{ title: "Markets", headerShown: false }} />
      <MarketsScreen />
    </>
  );
}
