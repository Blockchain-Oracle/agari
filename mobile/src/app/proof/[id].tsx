import { isAddress, toMarketId } from "@agari/core/types";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ProofScreen } from "~/features/proof/ProofScreen";

/** `/proof/[id]` — web's app/proof/[market]/page.tsx: a malformed id goes back to the markets (nothing 404s). */
export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id || !isAddress(id)) return <Redirect href="/markets" />;
  return <ProofScreen marketId={toMarketId(id)} />;
}
