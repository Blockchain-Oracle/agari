import { isTickerSymbol, TICKERS } from "@agari/core/market";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { TickerHubScreen } from "@/features/ticker-hub/TickerHubScreen";

interface Props {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const upper = (await params).symbol.toUpperCase();
  return { title: isTickerSymbol(upper) ? TICKER_HUB.title(upper, TICKERS[upper].name) : undefined };
}

/** `/tickers/<SYMBOL>` is the one spelling (a cashtag's link); any other case redirects to it, an unlisted ticker is a 404. */
export default async function Page({ params }: Props) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  if (!isTickerSymbol(upper)) notFound();
  if (symbol !== upper) redirect(`/tickers/${upper}`);
  return <TickerHubScreen symbol={upper} />;
}
