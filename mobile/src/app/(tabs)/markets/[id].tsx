import { isMarketId } from "@agari/core/types";
import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * `/markets/<id>` — web's app/markets/[id]/page.tsx renders the Markets page with that Window in the hero: here it is
 * `/markets?m=<id>` (a side, when the link names one, opens the ticket there); a mistyped id lands on /markets.
 */
export default function MarketRoute() {
  const { id, dir } = useLocalSearchParams<{ id: string; dir?: string }>();
  if (!isMarketId(id)) return <Redirect href="/markets" />;
  const side = dir === "up" || dir === "down" ? { dir } : {};
  return <Redirect href={{ pathname: "/markets", params: { m: id, ...side } }} />;
}
