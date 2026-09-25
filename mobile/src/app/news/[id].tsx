import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { openArticle } from "~/features/news/parts";

/**
 * `/news/<id>?url=` — web has no story page: a headline opens its source. An old link to a story here does the same
 * (the article in the in-app browser) and lands on the wire behind it.
 */
export default function StoryRoute() {
  const { url, symbol } = useLocalSearchParams<{ id: string; url?: string; symbol?: string }>();
  useEffect(() => {
    router.replace(symbol ? { pathname: "/news", params: { symbol } } : "/news");
    if (url) openArticle(url);
  }, [url, symbol]);
  return null;
}
