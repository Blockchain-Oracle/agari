import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { ago, clock, nextTopOfHour, span } from "@/features/desk/format";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Panel, RadialGauge } from "../kit";

/**
 * The next check (web's cockpit/CheckStrip.tsx): the hour's ring, the next and last check, the mode's note, and for
 * a practice desk six segments that fill one per check, Go live locked until they are done and the record opened.
 */
export function CheckStrip({ view, zone, nowSec, onGoLive }: { view: DeskView; zone: string | null; nowSec: number; onGoLive: (() => void) | null }) {
  const { color } = useTheme();
  const C = DESK.page.nextCheck;
  const atSec = nextTopOfHour(nowSec);
  const left = Math.max(0, Math.min(1, (atSec - nowSec) / 3_600));
  const active = view.state === "active" || view.state === "practice";
  const { practice } = view;
  return (
    <Panel title={C.title}>
      <View style={styles.main}>
        <RadialGauge value={left * 100} size={72} stroke={6} tone="accent" label={C.lead(clock(atSec, zone), span(atSec - nowSec))}>
          <Text style={[styles.ringText, { color: color.ink }]}>{span(atSec - nowSec)}</Text>
        </RadialGauge>
        <View style={styles.text}>
          <Text style={[TYPE.bodyStrong, { color: active ? color.ink : color.warning }]}>{active ? C.lead(clock(atSec, zone), span(atSec - nowSec)) : view.stateText}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {view.nextCheck.lastAtSec === null ? C.noCheck : C.lastCheck(ago(view.nextCheck.lastAtSec, nowSec))}
          </Text>
        </View>
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {DESK.modeNote[view.mode]} {C.also}
      </Text>
      {!view.isLive && view.exists ? (
        <View style={[styles.practice, { borderTopColor: color.hairline }]}>
          <View style={styles.practiceHead}>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{COCKPIT.check.practice}</Text>
            <Text style={[TYPE.data, { color: color.ink }]}>
              {Math.min(practice.done, practice.needed)}/{practice.needed}
            </Text>
          </View>
          <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: practice.needed }, (_, i) => (
              <View key={i} style={[styles.segment, { backgroundColor: i < practice.done ? color.accent : color.surface2 }]} />
            ))}
          </View>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {C.progress(practice.done, practice.needed)} · {practice.opened ? C.opened : C.notOpened}
            {practice.ready ? ` · ${C.goLiveReady}` : ""}
          </Text>
          {view.isOwner ? (
            <Button
              label={C.goLive}
              variant={practice.ready ? "primary" : "secondary"}
              icon={practice.ready ? { ios: "lock.open", android: "lock_open" } : { ios: "lock", android: "lock" }}
              disabled={!practice.ready || !onGoLive}
              onPress={onGoLive ?? undefined}
              accessibilityHint={practice.ready ? undefined : C.goLiveLocked(practice.needed)}
            />
          ) : null}
          {view.isOwner && !practice.ready ? (
            <View style={styles.locked}>
              <SymbolView name={{ ios: "lock", android: "lock" }} size={12} tintColor={color.inkMuted} />
              <Text style={[TYPE.caption, styles.lockedText, { color: color.inkMuted }]}>{C.goLiveLocked(practice.needed)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  main: { flexDirection: "row", alignItems: "center", gap: 14 },
  ringText: { fontFamily: FONT.dataStrong, fontSize: 12 },
  text: { flex: 1, gap: 2 },
  practice: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  practiceHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  segments: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: RADIUS.sm },
  locked: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  lockedText: { flex: 1 },
});
