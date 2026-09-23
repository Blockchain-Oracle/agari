import type { ReserveKind } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { EARN } from "@/features/earn/copy";
import { RESERVES, RESERVE_TABS } from "@/features/earn/reserves";
import { useVenue } from "@/features/markets/useVenue";
import { Chips, Screen } from "~/components/kit";
import { ReviewSheet, type ReviewRequest } from "~/features/short/ReviewSheet";
import { HouseEarn } from "./HouseEarn";
import { MakerEarn } from "./MakerEarn";

/**
 * `/earn` — web's `features/earn/EarnScreen.tsx`: one page per house reserve under one hero. The maker vault (the
 * liquidity that quotes the venue's books) is the default tab; range, parlay and boost keep the same two instructions.
 */
export function EarnScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ReserveKind>("maker");
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  // Four labels do not fit a 375-pt segmented track, so the tab row scrolls, as web's `.asset-tabs` does on a phone.
  const tabs = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist" accessibilityLabel={EARN.tabsLabel}>
      <Chips options={RESERVE_TABS.map((kind) => ({ value: kind, label: RESERVES[kind].label }))} value={tab} onPick={setTab} />
    </ScrollView>
  );
  return (
    <Screen title="Earn" onRefresh={() => queryClient.invalidateQueries()}>
      {tab === "maker" ? (
        <MakerEarn symbol={symbol} tabs={tabs} onReview={setReview} />
      ) : (
        <HouseEarn key={tab} kind={tab} symbol={symbol} tabs={tabs} onReview={setReview} />
      )}
      <ReviewSheet request={review} onClose={() => setReview(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingRight: 8 },
});
