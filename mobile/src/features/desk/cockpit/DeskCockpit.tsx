import { router, type Href } from "expo-router";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { COCKPIT, type CockpitTab } from "@/features/desk/cockpit/copy-cockpit";
import { DESK, DESK_ADVICE } from "@/features/desk/copy";
import { useInvalidateDesk } from "@/features/desk/useDesk";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button, Screen } from "~/components/kit";
import { SPACE, TYPE, useTheme } from "~/theme";
import { DeskControls } from "../controls/DeskControls";
import { GoLive } from "../controls/GoLive";
import { UnderlineTabs, type TabItem } from "../kit";
import { ActivityTimeline } from "../record/ActivityTimeline";
import { useDeskClock } from "../useDeskClock";
import { CheckStrip } from "./CheckStrip";
import { CockpitHeader } from "./CockpitHeader";
import { HoldingsTab } from "./HoldingsTab";
import { OverviewTab } from "./OverviewTab";
import { RulesTab } from "./RulesTab";
import { ValueHero } from "./ValueHero";

/**
 * The desk as a cockpit (web's DeskPage.tsx): the head, the owner's controls, the value chart, the next check, then
 * Overview · Holdings · Activity · Rules. A shared desk is the same screen read-only. Pull to refresh re-reads it.
 */
export function DeskCockpit({ view, actions, visitorCta = null }: {
  view: DeskView;
  actions: DeskActions | null;
  /** A visitor's way to their own desk, or into the studio when they have none. */
  visitorCta?: { href: string; label: string; primary: boolean } | null;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const { nowSec, zone } = useDeskClock();
  const invalidate = useInvalidateDesk();
  const [tab, setTab] = useState<CockpitTab>("overview");
  const [goLive, setGoLive] = useState(false);
  const base = `/desk/${view.wire.desk?.id ?? ""}`;
  const owner = view.isOwner && actions !== null;
  const needs = view.approvals.open.length;
  const tabs: TabItem<CockpitTab>[] = [
    { value: "overview", label: COCKPIT.tabs.overview, ...(needs > 0 ? { count: needs } : {}) },
    { value: "holdings", label: COCKPIT.tabs.holdings, ...(view.holdings.length > 0 ? { count: view.holdings.length } : {}) },
    { value: "activity", label: COCKPIT.tabs.activity, ...(view.wire.recent.length > 0 ? { count: view.wire.recent.length } : {}) },
    { value: "rules", label: COCKPIT.tabs.rules },
  ];
  const rise = (i: number) => (reduce ? undefined : FadeInDown.duration(400).delay(i * 70));
  return (
    <Screen title={view.isOwner ? DESK.title : DESK.visitorTitle} onRefresh={invalidate}>
      <Animated.View entering={rise(0)}>
        <CockpitHeader view={view} />
      </Animated.View>
      {owner ? <DeskControls view={view} actions={actions} nowSec={nowSec} zone={zone} /> : null}
      {visitorCta ? (
        <Button
          label={visitorCta.label}
          variant={visitorCta.primary ? "primary" : "outline"}
          icon={visitorCta.primary ? { ios: "plus", android: "add" } : undefined}
          onPress={() => router.push(visitorCta.href as Href)}
        />
      ) : null}
      <Animated.View entering={rise(1)} style={styles.stack}>
        <ValueHero view={view} nowSec={nowSec} />
        <CheckStrip view={view} zone={zone} nowSec={nowSec} onGoLive={owner ? () => setGoLive(true) : null} />
      </Animated.View>
      <Animated.View entering={rise(2)} style={styles.stack}>
        <UnderlineTabs value={tab} onChange={setTab} items={tabs} label={COCKPIT.tabsAria} />
        {tab === "overview" ? <OverviewTab view={view} actions={owner ? actions : null} base={base} zone={zone} nowSec={nowSec} /> : null}
        {tab === "holdings" ? <HoldingsTab view={view} /> : null}
        {tab === "activity" ? (
          <View style={styles.stack}>
            <ActivityTimeline records={view.wire.recent} base={base} nowSec={nowSec} zone={zone} />
            <Button label={COCKPIT.activity.whole.replace(" →", "")} variant="outline" trailing="→" onPress={() => router.push(`${base}/record` as Href)} />
          </View>
        ) : null}
        {tab === "rules" ? <RulesTab view={view} /> : null}
      </Animated.View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK_ADVICE}</Text>
      {owner && actions ? (
        <Modal visible={goLive} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGoLive(false)}>
          <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.sheet}>
            <GoLive view={view} actions={actions} liveMode="ask_first" zone={zone} nowSec={nowSec} />
            <Button label="Close" variant="outline" onPress={() => setGoLive(false)} />
          </ScrollView>
        </Modal>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  sheet: { padding: SPACE.gutter, paddingTop: 24, paddingBottom: 48, gap: 14 },
});
