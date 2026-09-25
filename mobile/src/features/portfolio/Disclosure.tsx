import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { Chevron } from "~/components/portfolio/web";

interface DisclosureProps {
  /** The row itself: tapping anywhere on it opens the panel (web `PoolRows`: "a row with controls IS its own disclosure"). */
  summary: ReactNode;
  children: ReactNode;
  accessibilityLabel: string;
  /** The chevron's ink (`.pool-chevron`: the plate's muted ink). */
  ink: string;
  summaryStyle?: StyleProp<ViewStyle>;
  panelStyle?: StyleProp<ViewStyle>;
}

/** web's `<details>` with `.pool-summary` / `.lp-disclosure-summary`: the drawn chevron turns 90° over 180 ms when open. */
export function Disclosure({ summary, children, accessibilityLabel, ink, summaryStyle, panelStyle }: DisclosureProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? "90deg" : "0deg", { duration: reduce ? 0 : 180 }) }] }));
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        style={[styles.summary, summaryStyle]}
      >
        <View style={styles.body}>{summary}</View>
        <Animated.View style={chevron}>
          <Chevron color={ink} />
        </Animated.View>
      </Pressable>
      {open ? <View style={panelStyle}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 12 },
  body: { flex: 1, minWidth: 0 },
});
