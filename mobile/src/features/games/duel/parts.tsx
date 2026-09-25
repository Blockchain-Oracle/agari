import { shortHex } from "@agari/core/units";
import { useEffect, useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { addressHue } from "@/lib/address-hue";
import { haptic } from "~/components/kit";
import { useGames } from "~/features/games/shell/context";
import { FONT, useTheme } from "~/theme";
import { duelTokens, type DuelTokens } from "~/theme/web/games-duel";

/**
 * The duel's small vocabulary from web's `duel.css`: the plate (`.du-plate`, `.du-notice`, `.du-error`), its title
 * (`.du-queue-title`) with the `.du-spinner`, body, footnote, blurb and deck lines, the `.du-refusal` box, the
 * facts row (`.du-facts`), the hue avatar, a seat, and the `.du-quiet` text button. Shared by every duel screen.
 */

/** duel.css's computed colours for the current theme, beside the app's own roles. */
export function useDuelTokens(): { d: DuelTokens; color: ReturnType<typeof useTheme>["color"] } {
  const { name, color } = useTheme();
  return useMemo(() => ({ d: duelTokens(name), color }), [name, color]);
}

/**
 * web's duel copy speaks of "this browser" holding the game key. On the phone the key lives on this phone, so the
 * text components say so — the one wording change, applied where every duel line is drawn.
 */
export function onPhone(text: string): string {
  return text
    .replace(/\bThis browser\b/g, "This phone")
    .replace(/\bthis browser\b/g, "this phone")
    .replace(/\bEach browser\b/g, "Each player's device")
    .replace(/\btwo browsers\b/g, "two devices")
    .replace(/\bbrowser\b/g, "device");
}

const phone = (children: ReactNode): ReactNode => (typeof children === "string" ? onPhone(children) : children);

/** `.du-plate` (surface-1, hairline, radius 16, padding 20, gap 12); `notice` is `.du-notice`, `error` is `.du-error`. */
export function Plate({ children, style, tone = "plain" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "plain" | "notice" | "error" }) {
  const { d, color } = useDuelTokens();
  if (tone === "notice") {
    return <View style={[styles.notice, { backgroundColor: color.surface2, borderColor: color.hairline }, style]}>{children}</View>;
  }
  return <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: tone === "error" ? d.errorBorder : color.hairline }, style]}>{children}</View>;
}

/** `.du-spinner`: a 12 px ring, vermilion at the top, turning every 900 ms (still when motion is reduced). */
export function Spinner() {
  const { d, color } = useDuelTokens();
  const { reducedMotion } = useGames();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    turn.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reducedMotion, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return <Animated.View style={[styles.spinner, { borderColor: d.spinnerTrack, borderTopColor: color.accent }, spin]} />;
}

/** `.du-queue-head` + `.du-queue-title`: Sora 700 15, with the spinner before it while something is in flight. */
export function PlateTitle({ children, spinning }: { children: string; spinning?: boolean }) {
  const { color } = useDuelTokens();
  return (
    <View style={styles.titleRow}>
      {spinning ? <Spinner /> : null}
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {onPhone(children)}
      </Text>
    </View>
  );
}

/** `.du-body`: Inter 13 / 1.65, gray-400. */
export function Body({ children }: { children: ReactNode }) {
  const { color } = useDuelTokens();
  return <Text style={[styles.body, { color: color.inkSecondary }]}>{phone(children)}</Text>;
}

/** `.du-foot`: mono 10 / 1.6, gray-400 (a tone for the few web colours with `.du-up` / `.du-down`). */
export function Foot({ children, tone }: { children: ReactNode; tone?: "profit" | "loss" | "accent" }) {
  const { color } = useDuelTokens();
  const ink = tone === "profit" ? color.profit : tone === "loss" ? color.loss : tone === "accent" ? color.accent : color.inkSecondary;
  return <Text style={[styles.foot, { color: ink }]}>{phone(children)}</Text>;
}

/** `.du-blurb`: Inter 12 / 1.6, gray-400. */
export function Blurb({ children }: { children: ReactNode }) {
  const { color } = useDuelTokens();
  return <Text style={[styles.blurb, { color: color.inkSecondary }]}>{phone(children)}</Text>;
}

/** `.du-deck`: the line that says what the venue can deal, in the ink colour, announced when it changes. */
export function DeckLine({ children }: { children: ReactNode }) {
  const { color } = useDuelTokens();
  return (
    <Text style={[styles.deck, { color: color.ink }]} accessibilityLiveRegion="polite">
      {phone(children)}
    </Text>
  );
}

/** `.du-refusal`: vermilion at 34 % around a 7 % wash, Inter 12, its children 6 apart. */
export function Refusal({ children }: { children: ReactNode }) {
  const { d, color } = useDuelTokens();
  return (
    <View style={[styles.refusal, { borderColor: d.refusalBorder, backgroundColor: d.refusalBg }]} accessibilityRole="alert">
      {typeof children === "string" ? <Text style={[styles.refusalText, { color: color.inkSecondary }]}>{onPhone(children)}</Text> : children}
    </View>
  );
}

/** `.du-k`: mono 9, 0.12em, uppercase, gray-500. */
export function Key({ children }: { children: ReactNode }) {
  const { color } = useDuelTokens();
  return <Text style={[styles.key, { color: color.inkMuted }]}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
}

/** `.du-v`: mono 14, the ink. */
export function Value({ children, tone }: { children: ReactNode; tone?: "profit" | "loss"; mono?: boolean }) {
  const { color } = useDuelTokens();
  const ink = tone === "profit" ? color.profit : tone === "loss" ? color.loss : color.ink;
  return (
    <Text style={[styles.value, { color: ink }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

/** `.du-facts`: key over value, wrapping 10 × 24 apart. */
export function Facts({ items }: { items: readonly { k: string; v: ReactNode; tone?: "profit" | "loss"; mono?: boolean }[] }) {
  return (
    <View style={styles.facts}>
      {items.map((item) => (
        <View key={item.k} style={styles.fact}>
          <Key>{item.k}</Key>
          <Value tone={item.tone}>{item.v}</Value>
        </View>
      ))}
    </View>
  );
}

/** web's `.du-avatar`: a disc in the address's own hue (`addressHue`), so one wallet is one colour everywhere. */
export function Avatar({ address, size = 28 }: { address: string | null; size?: number }) {
  const fill = `hsl(${address ? addressHue(address) : 0}, 58%, 52%)`;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill }} />;
}

/** `.du-seat`: the avatar, then the label over the short address in mono 12. */
export function Seat({ label, address, line, won, size }: { label?: string; address: string | null; line?: string | null; won?: boolean; size?: number }) {
  const { color } = useDuelTokens();
  return (
    <View style={styles.seat} accessible accessibilityLabel={`${label ?? ""} ${address ? shortHex(address, 6, 4) : "—"} ${line ?? ""}`}>
      <Avatar address={address} size={size} />
      <View style={styles.seatName}>
        {label ? <Key>{label}</Key> : null}
        <Text style={[styles.seatAddr, { color: color.ink }]} numberOfLines={1}>
          {address ? shortHex(address, 6, 4) : "—"}
        </Text>
        {line ? <Text style={[styles.key, { color: won ? color.profit : color.inkMuted }]}>{line}</Text> : null}
      </View>
    </View>
  );
}

/** web's `.du-quiet`: a mono 10 caps text button in gray-400, for cranks and "dismiss". */
export function Quiet({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { color } = useDuelTokens();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={12}
      style={({ pressed }) => [styles.quiet, pressed && { transform: [{ scale: 0.97 }] }, disabled && { opacity: 0.45 }]}
    >
      <Text style={[styles.quietText, { color: color.inkSecondary }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

export const duelStyles = StyleSheet.create({
  mono: { fontFamily: FONT.dataRegular },
});

const styles = StyleSheet.create({
  plate: { gap: 12, borderRadius: 16, padding: 20, borderWidth: 1 },
  notice: { gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  spinner: { width: 12, height: 12, borderRadius: 9999, borderWidth: 2 },
  title: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24, flexShrink: 1 },
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 21.45 },
  foot: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  blurb: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  deck: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  refusal: { gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  refusalText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18.6 },
  key: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08 },
  value: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, fontVariant: ["tabular-nums"] },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 10 },
  fact: { gap: 2 },
  seat: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 },
  seatName: { gap: 2, flexShrink: 1, minWidth: 0 },
  seatAddr: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  quiet: { alignSelf: "flex-start" },
  quietText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6 },
});
