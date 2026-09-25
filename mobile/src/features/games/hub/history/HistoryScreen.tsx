import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useWalletSession } from "@/lib/wallet-session";
import { GamesPage } from "~/features/games/frame";
import { DuelHistorySection } from "./DuelHistorySection";
import { LuckyHistorySection } from "./LuckyHistorySection";

/**
 * web's `/games/history` ("Your games"): the duels first, then the spins, each its own `.gm-page` section from its own
 * record — so the second opens 64 + 28 below the first, as the two stacked pages do on web. Pull to refresh re-reads both.
 */
export function HistoryScreen() {
  const { address } = useWalletSession();
  const [reload, setReload] = useState(0);
  return (
    <GamesPage onRefresh={address ? () => setReload((n) => n + 1) : undefined}>
      <DuelHistorySection address={address ?? null} reload={reload} />
      <View style={styles.next}>
        <LuckyHistorySection address={address ?? null} reload={reload} />
      </View>
    </GamesPage>
  );
}

const styles = StyleSheet.create({ next: { marginTop: 92 } });
