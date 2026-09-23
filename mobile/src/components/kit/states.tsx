import { diagnosisCopy, ERROR_BOUNDARY } from "@agari/core/copy";
import type { Reading } from "@agari/core/schemas";
import type { Diagnosis } from "@agari/core/types";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { openFunds } from "~/web-shims/credited";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Button } from "./Button";

/** A breathing placeholder block; still under Reduce Motion. */
export function Skeleton({ width = "100%", height = 16, radius = RADIUS.sm }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [reduce, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: color.surface2 }, style]} />;
}

export type LoadingShape = "line" | "row" | "plate" | "chart" | "list";

/** web's LoadingState: a skeleton only where nothing was ever known, never an invented number. */
export function LoadingState({ shape = "row", label = "Loading" }: { shape?: LoadingShape; label?: string }) {
  const row = (key: number) => (
    <View key={key} style={styles.row}>
      <Skeleton width={36} height={36} radius={18} />
      <View style={styles.rowText}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} />
      </View>
    </View>
  );
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={styles.loading}>
      {shape === "line" ? <Skeleton width="66%" /> : null}
      {shape === "row" ? row(0) : null}
      {shape === "list" ? [0, 1, 2, 3].map(row) : null}
      {shape === "plate" ? <Skeleton height={96} radius={RADIUS.lg} /> : null}
      {shape === "chart" ? <Skeleton height={190} radius={RADIUS.lg} /> : null}
    </View>
  );
}

/** web's EmptyState: says why it is empty and names the next action, never a blank panel. */
export function EmptyState({ why, detail, action }: { why: string; detail?: string; action?: { label: string; onPress: () => void } }) {
  const { color } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{why}</Text>
      {detail ? <Text style={[TYPE.body, { color: color.inkSecondary }]}>{detail}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" block={false} /> : null}
    </View>
  );
}

/** web's ErrorState: the diagnosis in human words, a retry where one can help, the technical line on request. */
export function ErrorState({ diagnosis, retry }: { diagnosis: Diagnosis; retry?: () => void }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const copy = diagnosisCopy(diagnosis.kind);
  const offerRetry = retry !== undefined && diagnosis.kind !== "not-deployed";
  return (
    <View accessibilityRole="alert" style={[styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{copy.headline}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{copy.body}</Text>
      {diagnosis.kind === "out-of-gas" || offerRetry ? (
        <View style={styles.actions}>
          {diagnosis.kind === "out-of-gas" ? <Button label="Get test funds" onPress={openFunds} size="sm" block={false} /> : null}
          {offerRetry ? <Button label={ERROR_BOUNDARY.retry} onPress={retry} variant="secondary" size="sm" block={false} /> : null}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" hitSlop={8}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{open ? "▾" : "▸"} {ERROR_BOUNDARY.technical}</Text>
      </Pressable>
      {open ? (
        <Text style={[TYPE.data, styles.technical, { color: color.inkSecondary }]} selectable>
          {diagnosis.kind}
          {diagnosis.errorName ? ` · ${diagnosis.errorName}` : ""}
          {"\n"}
          {diagnosis.technical}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Renders a chain-port Reading honestly: a skeleton until the first answer, the diagnosis if the first read failed,
 * otherwise the value — with a quiet "last good" marker when a refresh failed and the value is stale.
 */
export function ReadingView<T>({ reading, loading = "row", retry, children }: {
  reading: Reading<T> | null | undefined;
  loading?: LoadingShape;
  retry?: () => void;
  children: (value: T) => ReactNode;
}) {
  const { color } = useTheme();
  if (!reading) return <LoadingState shape={loading} />;
  if (!reading.ok) return <ErrorState diagnosis={reading.error} retry={retry} />;
  return (
    <>
      {reading.stale ? <Text style={[TYPE.caption, { color: color.warning }]}>Showing the last good read; the latest refresh failed.</Text> : null}
      {children(reading.value)}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { gap: 12, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, gap: 8 },
  panel: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10, alignItems: "flex-start" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  technical: { fontSize: 12 },
});
