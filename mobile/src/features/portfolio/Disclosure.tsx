import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { useTheme } from "~/theme";

interface DisclosureProps {
  /** The row itself: tapping anywhere on it opens the panel (web `PoolRows`: "a row with controls IS its own disclosure"). */
  summary: ReactNode;
  children: ReactNode;
  accessibilityLabel: string;
  /** The chevron's ink; the plate passes its cream ink. */
  ink?: string;
  defaultOpen?: boolean;
}

// 21st: hero_ui/heroui-disclosure
/**
 * web's `<details className="pool-line">` / `PlateDisclosure`: a summary row with a rotating chevron and an animated
 * panel, ported from the 21st Disclosure (trigger + indicator + content) to Reanimated. Reduce Motion drops the motion.
 */
export function Disclosure({ summary, children, accessibilityLabel, ink, defaultOpen = false }: DisclosureProps) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? "90deg" : "0deg", { duration: reduce ? 0 : 180 }) }],
  }));

  return (
    <Animated.View layout={reduce ? undefined : LinearTransition.duration(200)}>
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <View style={styles.body}>{summary}</View>
        <Animated.View style={chevron}>
          <SymbolView name={{ ios: "chevron.right", android: "chevron_right" }} size={13} tintColor={ink ?? color.inkMuted} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(180)} exiting={reduce ? undefined : FadeOut.duration(120)} style={styles.panel}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  pressed: { opacity: 0.7 },
  body: { flex: 1, minWidth: 0 },
  panel: { paddingBottom: 12 },
});
