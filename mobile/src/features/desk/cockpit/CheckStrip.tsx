import { router, type Href } from "expo-router";
import { ArrowRight, Check, Lock, LockOpen } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { ago, clock, nextTopOfHour, span } from "@/features/desk/format";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { DT, useDeskTheme } from "../kit";

/** web's components/data CountdownRing at 76 px: a 6-unit hairline track and the time left in the secondary ink. */
function CountdownRing({ fraction, children }: { fraction: number; children: string }) {
  const { color } = useDeskTheme();
  const left = Math.min(1, Math.max(0, fraction)) * 100;
  return (
    <View style={styles.ring}>
      <Svg width={76} height={76} viewBox="0 0 100 100" style={[StyleSheet.absoluteFill, styles.turn]}>
        <Circle cx={50} cy={50} r={46} strokeWidth={6} stroke={color.hairline} fill="none" />
        <Circle cx={50} cy={50} r={46} strokeWidth={6} stroke={color.inkSecondary} fill="none" strokeLinecap="round" strokeDasharray={[(left / 100) * 2 * Math.PI * 46, 2 * Math.PI * 46]} />
      </Svg>
      <Text style={[styles.ringText, { color: color.ink }]}>{children}</Text>
    </View>
  );
}

/** `.cp-tick`: an empty ring, filled with a tick once done (21st Onboarding Checklist #30552). */
function Tick({ on }: { on: boolean }) {
  const { color } = useDeskTheme();
  return <View style={[styles.tick, on ? { borderColor: color.accent, backgroundColor: color.accent } : { borderColor: color.hairline }]}>{on ? <Check size={12} strokeWidth={3} color={color.onAccent} /> : null}</View>;
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The next check (web's cockpit/CheckStrip.tsx): the hour's ring, the next and last check, the mode's note, and for a
 * practice desk the two-item checklist before Go live — six practice checks as six segments, and the record read.
 */
export function CheckStrip({ view, zone, nowSec, onGoLive }: { view: DeskView; zone: string | null; nowSec: number; onGoLive: (() => void) | null }) {
  const { color } = useDeskTheme();
  const C = DESK.page.nextCheck;
  const atSec = nextTopOfHour(nowSec);
  const active = view.state === "active" || view.state === "practice";
  const { practice } = view;
  const checksDone = practice.done >= practice.needed;
  const ready = practice.ready && onGoLive !== null;
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={C.title}>
      <Text style={[DT.panelTitle, { color: color.inkMuted }]}>{C.title}</Text>
      <View style={styles.main}>
        <CountdownRing fraction={(atSec - nowSec) / 3_600}>{span(atSec - nowSec)}</CountdownRing>
        <View style={styles.text}>
          <Text style={[styles.lead, { color: active ? color.ink : color.warning }]}>{upperFirst(active ? C.lead(clock(atSec, zone), span(atSec - nowSec)) : view.stateText)}</Text>
          <Text style={[DT.caption, { color: color.inkSecondary }]}>{view.nextCheck.lastAtSec === null ? C.noCheck : C.lastCheck(ago(view.nextCheck.lastAtSec, nowSec))}</Text>
        </View>
      </View>
      <Text style={[DT.caption, { color: color.inkMuted }]}>
        {C.note[view.mode]} {C.also}
      </Text>
      {!view.isLive && view.exists ? (
        <View style={[styles.practice, { borderTopColor: color.hairline }]}>
          <View style={styles.practiceHead}>
            <Text style={[DT.statLabel, { color: color.inkMuted }]}>{C.checklist}</Text>
            <Text style={[styles.count, { color: color.ink }]}>{(checksDone ? 1 : 0) + (practice.opened ? 1 : 0)}/2</Text>
          </View>
          <View style={styles.list}>
            <View style={styles.item}>
              <Tick on={checksDone} />
              <View style={styles.itemText}>
                <Text style={[styles.itemLabel, { color: checksDone ? color.inkSecondary : color.ink }]}>{C.checksDone(practice.done, practice.needed)}</Text>
                <View style={styles.segments}>
                  {Array.from({ length: practice.needed }, (_, i) => (
                    <View key={i} style={[styles.segment, i < practice.done ? { backgroundColor: color.accent, boxShadow: `0 0 10px ${color.accentDim}` } : { backgroundColor: color.surface2 }]} />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.item}>
              <Tick on={practice.opened} />
              <View style={styles.itemText}>
                <Text style={[styles.itemLabel, { color: practice.opened ? color.inkSecondary : color.ink }]}>{practice.opened ? C.recordRead : C.readRecord}</Text>
              </View>
              {!practice.opened && view.isOwner ? (
                <Pressable onPress={() => router.push(`/desk/${view.wire.desk?.id ?? ""}/record` as Href)} accessibilityRole="link" style={[styles.open, { borderColor: color.accent }]}>
                  <Text style={[styles.openText, { color: color.accent }]}>{C.open}</Text>
                  <ArrowRight size={13} color={color.accent} />
                </Pressable>
              ) : null}
            </View>
          </View>
          {view.isOwner ? (
            <Pressable
              onPress={onGoLive ?? undefined}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
              style={[styles.goLive, practice.ready ? { borderColor: color.accent, backgroundColor: color.accent } : { borderColor: color.hairline, borderStyle: "dashed" }]}
            >
              {practice.ready ? <LockOpen size={15} color={color.onAccent} /> : <Lock size={15} color={color.inkMuted} />}
              <Text style={[styles.goLiveText, { color: practice.ready ? color.onAccent : color.inkMuted }]}>{C.goLive}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderWidth: 1, borderRadius: 16 },
  main: { flexDirection: "row", alignItems: "center", gap: 14 },
  ring: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  turn: { transform: [{ rotate: "-90deg" }] },
  ringText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  text: { flex: 1, gap: 4 },
  lead: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 20.25 },
  practice: { gap: 8, paddingTop: 12, borderTopWidth: 1 },
  practiceHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  count: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  list: { gap: 10 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tick: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1, gap: 6, paddingTop: 1 },
  itemLabel: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  segments: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 3 },
  open: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 28, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1 },
  openText: { fontFamily: FONT.heading, fontSize: 12 },
  goLive: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 40, borderRadius: 9999, borderWidth: 1 },
  goLiveText: { fontFamily: FONT.heading, fontSize: 13 },
});
