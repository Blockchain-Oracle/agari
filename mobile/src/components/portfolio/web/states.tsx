import { diagnosisCopy, ERROR_BOUNDARY } from "@agari/core/copy";
import { isOk, type Reading } from "@agari/core/schemas";
import type { Diagnosis } from "@agari/core/types";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { openFunds } from "~/web-shims/credited";
import { useTheme } from "~/theme";
import { portfolioTokens, WEB_TYPE } from "~/theme/web/portfolio";
import { WebButton } from "./Button";

/** web `ui/skeleton`: animate-pulse rounded-md bg-muted. */
export function Skeleton({ width = "100%", height = 16, radius = 8 }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { name } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
  }, [reduce, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: portfolioTokens(name).skeleton }, style]} />;
}

export type LoadingShape = "line" | "row" | "plate" | "chart" | "ticket";

/** web `LoadingState`: a skeleton only where nothing was ever known. */
export function LoadingState({ shape = "line", label = "Loading", style }: { shape?: LoadingShape; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={[styles.loading, style]}>
      {shape === "line" ? <Skeleton width="66%" /> : null}
      {shape === "row" ? (
        <View style={styles.row}>
          <Skeleton width={32} height={32} radius={9999} />
          <View style={styles.rowText}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="33%" height={12} />
          </View>
        </View>
      ) : null}
      {shape === "plate" ? <Skeleton height={96} radius={12} /> : null}
      {shape === "chart" ? <Skeleton height={192} radius={12} /> : null}
      {shape === "ticket" ? (
        <>
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={52} />
        </>
      ) : null}
    </View>
  );
}

export interface NextAction {
  label: string;
  onPress: () => void;
}

/** web `EmptyState`: rounded-lg border bg-surface-1 p-4, the why in type-body, a secondary sm button. */
export function EmptyState({ why, nextAction, style }: { why: string; nextAction?: NextAction; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  return (
    <View style={[styles.panel, styles.start, { backgroundColor: color.surface1, borderColor: color.hairline }, style]}>
      <Text style={[WEB_TYPE.body, { color: color.ink }]}>{why}</Text>
      {nextAction ? <WebButton label={nextAction.label} onPress={nextAction.onPress} variant="secondary" size="sm" /> : null}
    </View>
  );
}

/** web `ErrorState`: the diagnosis in human words, retry where it can help, the technical line behind a disclosure. */
export function ErrorState({ diagnosis, retry, style }: { diagnosis: Diagnosis; retry?: () => void; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const copy = diagnosisCopy(diagnosis.kind);
  const offerRetry = retry !== undefined && diagnosis.kind !== "not-deployed";
  return (
    <View accessibilityRole="alert" style={[styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }, style]}>
      <View style={styles.copy}>
        <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]}>{copy.headline}</Text>
        <Text style={[WEB_TYPE.body, { color: color.inkSecondary }]}>{copy.body}</Text>
      </View>
      {diagnosis.kind === "out-of-gas" || offerRetry ? (
        <View style={styles.actions}>
          {diagnosis.kind === "out-of-gas" ? <WebButton label="Get test funds" onPress={openFunds} size="sm" /> : null}
          {offerRetry ? <WebButton label={ERROR_BOUNDARY.retry} onPress={retry} variant="secondary" size="sm" /> : null}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={8}>
        <Text style={[WEB_TYPE.caption, { color: color.inkMuted }]}>
          {open ? "▾" : "▸"} {ERROR_BOUNDARY.technical}
        </Text>
      </Pressable>
      {open ? (
        <Text style={[WEB_TYPE.caption, WEB_TYPE.numbers, styles.technical, { color: color.inkSecondary }]} selectable>
          {diagnosis.kind}
          {diagnosis.errorName ? ` · ${diagnosis.errorName}` : ""}
          {"\n"}
          {diagnosis.technical}
        </Text>
      ) : null}
    </View>
  );
}

interface ReadingBoundaryProps<T> {
  reading: Reading<T> | null;
  shape?: LoadingShape;
  isEmpty?: (value: T) => boolean;
  empty?: { why: string; nextAction?: NextAction };
  retry?: () => void;
  style?: StyleProp<ViewStyle>;
  children: (value: T) => ReactNode;
}

/** web `ReadingBoundary`: loading → skeleton, error → honest diagnosis, empty → why and what next. */
export function ReadingBoundary<T>({ reading, shape = "plate", isEmpty, empty, retry, style, children }: ReadingBoundaryProps<T>) {
  if (reading === null) return <LoadingState shape={shape} style={style} />;
  if (!isOk(reading)) return <ErrorState diagnosis={reading.error} retry={retry} style={style} />;
  if (empty && isEmpty?.(reading.value)) return <EmptyState why={empty.why} nextAction={empty.nextAction} style={style} />;
  return <>{children(reading.value)}</>;
}

const styles = StyleSheet.create({
  loading: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, gap: 8 },
  panel: { gap: 12, borderRadius: 12, borderWidth: 1, padding: 16 },
  start: { alignItems: "flex-start" },
  copy: { gap: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  technical: { marginTop: 8 },
});
