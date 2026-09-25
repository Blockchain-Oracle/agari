import { RefreshCw, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT, useTheme } from "~/theme";
import { statusTokens } from "~/theme/web/explore/status";

/**
 * The parts of Masayume's `/status` frame (styles/status.css) both proof pages stand on: the holding states and the
 * hairline table with its micro title.
 */
export function Holding({ kind, text }: { kind: "loading" | "alert" | "plain"; text: string }) {
  const { name, color } = useTheme();
  const t = statusTokens(name);
  return (
    <View
      style={styles.holding}
      accessibilityRole={kind === "alert" ? "alert" : kind === "loading" ? "progressbar" : "text"}
      accessibilityLabel={text}
    >
      {kind === "loading" ? <Spinner ink={color.inkMuted} /> : null}
      {kind === "alert" ? <TriangleAlert size={32} color={t.amber} style={styles.holdingIcon} /> : null}
      <Text style={[styles.holdingText, { color: kind === "alert" ? color.inkSecondary : color.inkMuted }]}>{text}</Text>
    </View>
  );
}

/** `animate-spin` on the refresh glyph. */
function Spinner({ ink }: { ink: string }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={[styles.holdingIcon, { transform: [{ rotate }] }]}>
      <RefreshCw size={20} color={ink} />
    </Animated.View>
  );
}

/** `.status-table`: the ground-filled hairline card, its `.status-table-head` title, then the rows. */
export function StatusTable({ title, children }: { title: string; children: ReactNode }) {
  const { name, color } = useTheme();
  const t = statusTokens(name);
  return (
    <View style={[styles.table, { backgroundColor: color.ground, borderColor: t.hairline }]}>
      <View style={[styles.head, { borderBottomColor: t.rule }]}>
        <Text style={[styles.title, { color: color.inkDisabled }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** shadcn's `Skeleton`: a pulsing surface-2 block. */
export function Skeleton({ style }: { style: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.skeleton, { backgroundColor: color.surface2, opacity: pulse }, style]} />;
}

const styles = StyleSheet.create({
  holding: { paddingVertical: 48, alignItems: "center" },
  holdingIcon: { marginBottom: 12 },
  holdingText: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4, textAlign: "center" },
  table: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  head: { paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1 },
  title: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  skeleton: { borderRadius: 8 },
});
