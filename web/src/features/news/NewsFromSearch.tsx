"use client";

import { isTickerSymbol } from "@agari/core/market";
import { useSearchParams } from "next/navigation";
import { NewsFeed } from "./NewsFeed";
import { NewsHead } from "./NewsHead";

/** `/news?symbol=TSLA`: a registry ticker narrows the head and the wire; anything else reads the whole wire. */
export function NewsFromSearch() {
  const raw = useSearchParams().get("symbol")?.toUpperCase() ?? null;
  const symbol = isTickerSymbol(raw) ? raw : null;
  return (
    <>
      <NewsHead symbol={symbol} />
      <NewsFeed symbol={symbol} />
    </>
  );
}
