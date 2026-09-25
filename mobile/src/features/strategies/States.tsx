import { diagnosisCopy, ERROR_BOUNDARY } from "@agari/core/copy";
import { isOk, type Reading } from "@agari/core/schemas";
import type { Diagnosis } from "@agari/core/types";
import { router, type Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { FONT, TYPE } from "~/theme";
import { useStrat } from "./ui";

/** web components/states LoadingState "plate": one h-24 rounded-lg bg-muted skeleton, pulsing. */
function PlateSkeleton() {
  const { color } = useStrat();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
  }, [reduce, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
      <Animated.View style={[styles.plate, { backgroundColor: color.surface2 }, style]} />
    </View>
  );
}

/** web components/states ErrorState (inline): the diagnosis in words, Retry where it can help, the technical line folded. */
function ErrorState({ diagnosis, retry }: { diagnosis: Diagnosis; retry?: () => void }) {
  const { color } = useStrat();
  const [open, setOpen] = useState(false);
  const copy = diagnosisCopy(diagnosis.kind);
  const offerRetry = retry !== undefined && diagnosis.kind !== "not-deployed";
  return (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.errorCopy}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{copy.headline}</Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{copy.body}</Text>
      </View>
      {offerRetry ? (
        <Pressable onPress={retry} accessibilityRole="button" style={[styles.retry, { backgroundColor: color.surface2 }]}>
          <Text style={[styles.retryText, { color: color.ink }]}>{ERROR_BOUNDARY.retry}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {open ? "▾" : "▸"} {ERROR_BOUNDARY.technical}
        </Text>
      </Pressable>
      {open ? (
        <Text selectable style={[TYPE.caption, { color: color.inkSecondary, fontFamily: FONT.dataRegular }]}>
          {diagnosis.kind}
          {diagnosis.errorName ? ` · ${diagnosis.errorName}` : ""}
          {"\n"}
          {diagnosis.technical}
        </Text>
      ) : null}
    </View>
  );
}

/** web's ReadingBoundary with shape "plate", as /strategies and /agents use it. */
export function ReadingBoundary<T>({ reading, retry, children }: { reading: Reading<T> | null; retry?: () => void; children: (value: T) => ReactNode }) {
  if (reading === null) return <PlateSkeleton />;
  if (!isOk(reading)) return <ErrorState diagnosis={reading.error} retry={retry} />;
  return <>{children(reading.value)}</>;
}

/** web components/shell/CapabilityPending (shell.css `.capability-pending`): what the surface waits on, and a way out. */
export function CapabilityPending({ eyebrow, title, body, dependency }: { eyebrow: string; title: string; body: string; dependency: string }) {
  const { t, color, name } = useStrat();
  return (
    <View style={styles.pending}>
      <Text style={[styles.cpMono, { color: t.vermilion }]}>{eyebrow}</Text>
      <Text style={[styles.cpTitle, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.cpBody, { color: color.inkSecondary }]}>{body}</Text>
      <Text style={[styles.cpMeta, { color: color.inkMuted, borderTopColor: t.ink(name === "dark" ? 0.08 : 0.12) }]}>Not connected yet · waiting on {dependency}</Text>
      <Pressable onPress={() => router.push("/markets" as Href)} accessibilityRole="link">
        <Text style={[styles.cpMono, styles.cpAction, { color: t.vermilion }]}>Make a call on the markets →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { height: 96, borderRadius: 8 },
  error: { gap: 12, borderRadius: 8, borderWidth: 1, padding: 16, alignItems: "flex-start" },
  errorCopy: { gap: 4, alignSelf: "stretch" },
  retry: { height: 44, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
  retryText: { fontFamily: FONT.bodyMedium, fontSize: 13.125, lineHeight: 18.75 },
  pending: { paddingVertical: 48 },
  cpMono: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76, textTransform: "uppercase" },
  cpTitle: { marginTop: 12, fontFamily: FONT.heading, fontSize: 28, lineHeight: 32.2, letterSpacing: -0.56 },
  cpBody: { marginTop: 12, fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  cpMeta: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  cpAction: { marginTop: 16 },
});
