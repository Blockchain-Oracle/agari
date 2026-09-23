import { shortHex } from "@agari/core/units";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { addressHue } from "@/lib/address-hue";
import { haptic } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";

/**
 * The duel's small vocabulary from web's `duel.css`: the plate (`.du-plate`), its title with the spinner, body,
 * footnote and deck lines, the vermilion refusal box, the facts row (`.du-facts`), the hue avatar, a seat, and the
 * quiet text button. Shared by every duel screen.
 */

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

export function Plate({ children, style, tone = "plain" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "plain" | "notice" }) {
  const { color } = useTheme();
  const bg = tone === "notice" ? color.surface2 : color.surface1;
  return <View style={[styles.plate, { backgroundColor: bg, borderColor: color.hairline }, style]}>{children}</View>;
}

export function PlateTitle({ children, spinning }: { children: string; spinning?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.titleRow}>
      {spinning ? <ActivityIndicator size="small" color={color.accent} /> : null}
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

export function Body({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <Text style={[styles.body, { color: color.inkSecondary }]}>{phone(children)}</Text>;
}

export function Foot({ children, tone }: { children: ReactNode; tone?: "profit" | "loss" | "accent" }) {
  const { color } = useTheme();
  const ink = tone === "profit" ? color.profit : tone === "loss" ? color.loss : tone === "accent" ? color.accent : color.inkSecondary;
  return <Text style={[styles.foot, { color: ink }]}>{phone(children)}</Text>;
}

/** web's `.du-deck`: the line that says what the venue can deal, in the ink colour, announced when it changes. */
export function DeckLine({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return (
    <Text style={[styles.body, { color: color.ink }]} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

export function Refusal({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.refusal, { borderColor: color.accentDim, backgroundColor: color.accentWash }]} accessibilityRole="alert">
      {typeof children === "string" ? <Text style={[styles.refusalText, { color: color.inkSecondary }]}>{onPhone(children)}</Text> : children}
    </View>
  );
}

export function Key({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <Text style={[styles.key, { color: color.inkMuted }]}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
}

export function Value({ children, tone, mono }: { children: ReactNode; tone?: "profit" | "loss"; mono?: boolean }) {
  const { color } = useTheme();
  const ink = tone === "profit" ? color.profit : tone === "loss" ? color.loss : color.ink;
  return (
    <Text style={[styles.value, mono && styles.mono, { color: ink }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

export function Facts({ items }: { items: readonly { k: string; v: ReactNode; tone?: "profit" | "loss"; mono?: boolean }[] }) {
  return (
    <View style={styles.facts}>
      {items.map((item) => (
        <View key={item.k} style={styles.fact}>
          <Key>{item.k}</Key>
          <Value tone={item.tone} mono={item.mono}>
            {item.v}
          </Value>
        </View>
      ))}
    </View>
  );
}

/** web's `.du-avatar`: a disc in the address's own hue (`addressHue`), so one wallet is one colour everywhere. */
export function Avatar({ address, size = 28 }: { address: string | null; size?: number }) {
  const { color } = useTheme();
  const fill = address ? `hsl(${addressHue(address)}, 58%, 52%)` : color.surface3;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill }} />;
}

export function Seat({ label, address, line, won }: { label?: string; address: string | null; line?: string | null; won?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.seat} accessible accessibilityLabel={`${label ?? ""} ${address ? shortHex(address, 6, 4) : "—"} ${line ?? ""}`}>
      <Avatar address={address} />
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

/** web's `.du-quiet`: a small mono caps text button, for cranks and "dismiss". Still a 44-pt target. */
export function Quiet({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { color } = useTheme();
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
      hitSlop={6}
      style={({ pressed }) => [styles.quiet, (pressed || disabled) && { opacity: 0.5 }]}
    >
      <Text style={[styles.quietText, { color: color.accent }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: { gap: 12, borderRadius: 16, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 21 },
  foot: { fontFamily: FONT.data, fontSize: 10.5, lineHeight: 16 },
  refusal: { gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  refusalText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  key: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1.1 },
  value: { ...TYPE.data },
  mono: { fontFamily: FONT.data },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 10 },
  fact: { gap: 2 },
  seat: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  seatName: { gap: 2, flexShrink: 1 },
  seatAddr: { fontFamily: FONT.data, fontSize: 12 },
  quiet: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  quietText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.7 },
});
