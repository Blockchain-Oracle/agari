import { useState } from "react";
import { GAMES } from "@/features/games/copy";
import { LUCKY } from "@/features/games/lucky/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { EmptyState, Screen } from "~/components/kit";
import { GameHeaderActions } from "~/features/games/shell";
import { DuelHistorySection } from "./DuelHistorySection";
import { LuckyHistorySection } from "./LuckyHistorySection";

/**
 * web's `/games/history` ("Your games"): the duels first, then the spins, each from its own record. Without a
 * wallet there is nothing to read, and the screen says so with the one action that changes it.
 */
export function HistoryScreen() {
  const { address, connect } = useWalletSession();
  const [reload, setReload] = useState(0);
  return (
    <Screen
      title="Your games"
      headerRight={() => <GameHeaderActions />}
      onRefresh={address ? () => setReload((n) => n + 1) : undefined}
    >
      {address ? (
        <>
          <DuelHistorySection address={address} reload={reload} />
          <LuckyHistorySection address={address} reload={reload} />
        </>
      ) : (
        <EmptyState
          why={GAMES.historyPage.connect}
          detail={LUCKY.history.connect}
          action={{ label: "Connect a wallet", onPress: connect }}
        />
      )}
    </Screen>
  );
}
