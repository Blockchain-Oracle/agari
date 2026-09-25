import { router, useLocalSearchParams, type Href } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { COCKPIT, COCKPIT_TABS, type CockpitTab } from "@/features/desk/cockpit/copy-cockpit";
import { DESK, DESK_ADVICE } from "@/features/desk/copy";
import { GO_LIVE } from "@/features/desk/copy-controls";
import { useInvalidateDesk } from "@/features/desk/useDesk";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import { ExplorePage } from "~/features/explore/ExplorePage";
import type { NativeDeskView as DeskView } from "../native-view";
import { DeskControls } from "../controls/DeskControls";
import { DeskDialog } from "../controls/DeskDialog";
import { GoLive } from "../controls/GoLive";
import { DkControl, DT, UnderlineTabs, useDeskTheme, type TabItem } from "../kit";
import { useDeskClock } from "../useDeskClock";
import { ActivityTab } from "../record/ActivityTimeline";
import { CheckStrip } from "./CheckStrip";
import { CockpitHeader } from "./CockpitHeader";
import { HoldingsTab } from "./HoldingsTab";
import { OverviewTab } from "./OverviewTab";
import { RulesTab } from "./RulesTab";
import { ValueHero } from "./ValueHero";

/** web's `Rise`: each block fades up 12 px, 70 ms after the one before. */
function Rise({ i, children }: { i: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  return <Animated.View entering={reduce ? undefined : FadeInDown.duration(400).delay(i * 70).easing(Easing.bezier(0.22, 1, 0.36, 1))}>{children}</Animated.View>;
}

/**
 * The desk page as a cockpit (web's DeskPage.tsx at 402 px): the head with the owner's toolbar (or a visitor's way to
 * their own desk), the value hero and the next check, then Overview · Holdings · Activity · Rules, and the advice line.
 * A shared desk is the same page read-only. Pull to refresh re-reads it.
 */
export function DeskCockpit({ view, actions, visitorCta = null }: {
  view: DeskView;
  actions: DeskActions | null;
  /** A visitor's way to their own desk, or into the studio when they have none. */
  visitorCta?: { href: string; label: string; primary: boolean } | null;
}) {
  const { color } = useDeskTheme();
  const { nowSec, zone } = useDeskClock();
  const invalidate = useInvalidateDesk();
  // web keeps the tab in `?tab=`; so does the route here, so a shared link opens on the same tab.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTabState] = useState<CockpitTab>(() => ((COCKPIT_TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as CockpitTab) : "overview"));
  const setTab = (t: CockpitTab) => {
    setTabState(t);
    router.setParams({ tab: t === "overview" ? undefined : t });
  };
  const [goLive, setGoLive] = useState(false);
  const base = `/desk/${view.wire.desk?.id ?? ""}`;
  const owner = view.isOwner && actions !== null;
  const tabs: TabItem<CockpitTab>[] = COCKPIT_TABS.map((value) => ({ value, label: COCKPIT.tabs[value] }));
  return (
    <ExplorePage title={view.isOwner ? DESK.title : DESK.visitorTitle} onRefresh={invalidate} style={styles.page}>
      <Rise i={0}>
        <CockpitHeader
          view={view}
          actions={
            visitorCta ? (
              <DkControl label={visitorCta.label} tone={visitorCta.primary ? "primary" : undefined} icon={visitorCta.primary ? Plus : undefined} onPress={() => router.push(visitorCta.href as Href)} style={styles.cta} />
            ) : (
              <DeskControls view={view} actions={owner ? actions : null} zone={zone} nowSec={nowSec} />
            )
          }
        />
      </Rise>
      <Rise i={1}>
        <View style={styles.top}>
          <ValueHero view={view} nowSec={nowSec} />
          <CheckStrip view={view} zone={zone} nowSec={nowSec} onGoLive={owner ? () => setGoLive(true) : null} />
        </View>
      </Rise>
      <Rise i={2}>
        <View style={styles.tabs}>
          <UnderlineTabs value={tab} onChange={setTab} items={tabs} label={COCKPIT.tabsAria} />
          <Animated.View key={tab} entering={FadeInDown.duration(280).easing(Easing.bezier(0.22, 1, 0.36, 1))}>
            {tab === "overview" ? <OverviewTab view={view} actions={owner ? actions : null} base={base} zone={zone} nowSec={nowSec} /> : null}
            {tab === "holdings" ? <HoldingsTab view={view} /> : null}
            {tab === "activity" ? <ActivityTab records={view.wire.recent} base={base} nowSec={nowSec} zone={zone} /> : null}
            {tab === "rules" ? <RulesTab view={view} /> : null}
          </Animated.View>
        </View>
      </Rise>
      <Text style={[DT.caption, { color: color.inkMuted }]}>{DESK_ADVICE}</Text>
      {owner && actions ? (
        <DeskDialog open={goLive} onClose={() => setGoLive(false)} title={GO_LIVE.title}>
          {goLive ? <GoLive view={view} actions={actions} liveMode="ask_first" zone={zone} nowSec={nowSec} /> : null}
        </DeskDialog>
      ) : null}
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, gap: 22 },
  cta: { paddingHorizontal: 18, gap: 6 },
  top: { gap: 16 },
  tabs: { gap: 20 },
});
