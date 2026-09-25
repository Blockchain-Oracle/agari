import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

/**
 * `/strategies/<id>` — web has no strategy page: a strategy opens as the copy drawer on
 * `/strategies?view=copy&strategy=<id>`. An old link here lands there.
 */
export default function StrategyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    router.replace({ pathname: "/strategies", params: { view: "copy", strategy: id } });
  }, [id]);
  return null;
}
