import type { ReserveKind } from "@agari/core/reserves";
import { isOk } from "@agari/core/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import { RESERVES, RESERVE_TABS } from "@/features/earn/reserves";
import { useVenue } from "@/features/markets/useVenue";
import { Screen } from "~/components/kit";
import { FONT } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { useEarnParlay } from "./EarnKit";
import { HouseEarn } from "./HouseEarn";
import { MakerEarn } from "./MakerEarn";

/**
 * `/earn` — web's `features/earn/EarnScreen.tsx`: one page per house reserve under one hero. The maker vault is the
 * default tab; range, parlay and boost keep the same books and the same two liquidity instructions.
 */
export function EarnScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ReserveKind>("maker");
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const tabs = <ReserveTabs active={tab} onSelect={setTab} />;
  return (
    <Screen title={EARN.devTitle} onRefresh={() => queryClient.invalidateQueries()} contentStyle={styles.page}>
      {tab === "maker" ? <MakerEarn symbol={symbol} tabs={tabs} /> : <HouseEarn key={tab} kind={tab} symbol={symbol} tabs={tabs} />}
    </Screen>
  );
}

/** web's `features/earn/ReserveTabs.tsx`: the leaderboard's `.asset-tabs` row in `.ea-tabs`, scrolling sideways on a phone. */
function ReserveTabs({ active, onSelect }: { active: ReserveKind; onSelect: (kind: ReserveKind) => void }) {
  const { color, t } = useEarnParlay();
  return (
    <View style={styles.tabsWrap}>
      <View style={[styles.tabsRule, { borderBottomColor: t.tabsRule }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist" accessibilityLabel={EARN.tabsLabel}>
          {RESERVE_TABS.map((kind) => {
            const on = kind === active;
            return (
              <Pressable
                key={kind}
                onPress={() => onSelect(kind)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.tab, { borderBottomColor: on ? color.accent : t.clear }]}
              >
                <Text style={[styles.tabText, { color: on ? color.ink : color.inkMuted }]}>{RESERVES[kind].label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 0, paddingTop: 0, paddingBottom: CHROME.dockClearance, gap: 0 },
  tabsWrap: { paddingTop: 20, paddingHorizontal: 18 },
  tabsRule: { borderBottomWidth: 1 },
  tabs: { flexDirection: "row", alignItems: "center", gap: 18, paddingBottom: 12 },
  tab: { paddingVertical: 4, borderBottomWidth: 1 },
  tabText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
});
