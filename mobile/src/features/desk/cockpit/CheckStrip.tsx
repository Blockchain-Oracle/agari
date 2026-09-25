import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { ago, clock, nextTopOfHour, span } from "@/features/desk/format";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Panel, RadialGauge } from "../kit";

/**
 * The next check (web's cockpit/CheckStrip.tsx): the hour's ring, the next and last check, the mode's note, and for
 * a practice desk the two-item checklist before Go live: six practice checks (six segments fill one per check) and the
 * record read.
 */
/** A checklist mark (21st's Onboarding Checklist #30552): an empty ring, filled with a tick once done. */
function Tick({ on }: { on: boolean }) {
  const { color } = useTheme();
  return (
    <View style={[styles.tick, on ? { backgroundColor: color.accent, borderColor: color.accent } : { borderColor: color.hairline }]}>
      {on ? <SymbolView name={{ ios: "checkmark", android: "check" }} size={11} weight="heavy" tintColor={color.onAccent} /> : null}
    </View>
  );
}

export function CheckStrip({ view, zone, nowSec, onGoLive }: { view: DeskView; zone: string | null; nowSec: number; onGoLive: (() => void) | null }) {
  const { color } = useTheme();
  const C = DESK.page.nextCheck;
  const atSec = nextTopOfHour(nowSec);
  const left = Math.max(0, Math.min(1, (atSec - nowSec) / 3_600));
  const active = view.state === "active" || view.state === "practice";
  const { practice } = view;
  const checksDone = practice.done >= practice.needed;
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
        {C.note[view.mode]} {C.also}
      </Text>
      {!view.isLive && view.exists ? (
        <View style={[styles.practice, { borderTopColor: color.hairline }]}>
          <View style={styles.practiceHead}>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{C.checklist}</Text>
            <Text style={[TYPE.data, { color: color.ink }]}>{(checksDone ? 1 : 0) + (practice.opened ? 1 : 0)}/2</Text>
          </View>
          <View style={styles.list}>
            <View style={styles.item}>
              <Tick on={checksDone} />
              <View style={styles.itemText}>
                <Text style={[TYPE.caption, { color: checksDone ? color.inkSecondary : color.ink }]}>{C.checksDone(practice.done, practice.needed)}</Text>
                <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {Array.from({ length: practice.needed }, (_, i) => (
                    <View key={i} style={[styles.segment, { backgroundColor: i < practice.done ? color.accent : color.surface2 }]} />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.item}>
              <Tick on={practice.opened} />
              <View style={styles.itemText}>
                <Text style={[TYPE.caption, { color: practice.opened ? color.inkSecondary : color.ink }]}>{practice.opened ? C.recordRead : C.readRecord}</Text>
              </View>
              {!practice.opened && view.isOwner && view.wire.desk ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push(`/desk/${view.wire.desk?.id ?? ""}/record` as Href)}
                  style={[styles.open, { borderColor: color.accent }]}
                >
                  <Text style={[styles.openText, { color: color.accent }]}>{C.open}</Text>
                  <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={12} tintColor={color.accent} />
                </Pressable>
              ) : null}
            </View>
          </View>
          {view.isOwner ? (
            <Button
              label={C.goLive}
              variant={practice.ready ? "primary" : "secondary"}
              icon={practice.ready ? { ios: "lock.open", android: "lock_open" } : { ios: "lock", android: "lock" }}
              disabled={!practice.ready || !onGoLive}
              onPress={onGoLive ?? undefined}
            />
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
  list: { gap: 10 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  itemText: { flex: 1, minWidth: 0, gap: 6, paddingTop: 1 },
  tick: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  open: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 28, paddingHorizontal: 12, borderRadius: RADIUS.full, borderWidth: 1 },
  openText: { fontFamily: FONT.heading, fontSize: 12 },
});
