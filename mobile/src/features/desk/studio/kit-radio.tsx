import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, useTheme } from "~/theme";
import { DashedRule, Wash } from "./kit-bits";

export interface RadioCardItem<T extends string> {
  value: T;
  title: ReactNode;
  body?: ReactNode;
  media?: ReactNode;
  footer?: ReactNode;
}

/**
 * desk-kit `RadioCards` (web primitives.tsx, 21st #28351): cards that behave as one radio group, one column at phone
 * width. The chosen card wears the accent ring and a wash fading down to 70%; the dot fills.
 */
export function RadioCards<T extends string>({ value, onChange, items, label }: { value: T | null; onChange: (v: T) => void; items: readonly RadioCardItem<T>[]; label: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.cards} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.card, { backgroundColor: color.surface1, borderColor: on ? color.accent : color.hairline }, on && styles.checked]}
          >
            {on ? <Wash id={`rc-${item.value}`} kind="top" color={color.accentWash} fade={0.7} /> : null}
            <View style={[styles.dot, { borderColor: on ? color.accent : color.inkMuted }]}>{on ? <View style={[styles.dotOn, { backgroundColor: color.accent }]} /> : null}</View>
            {item.media ? <View style={styles.media}>{item.media}</View> : null}
            {typeof item.title === "string" ? <Text style={[styles.title, { color: color.ink }]}>{item.title}</Text> : item.title}
            {item.body ? typeof item.body === "string" ? <Text style={[styles.body, { color: color.inkSecondary }]}>{item.body}</Text> : item.body : null}
            {item.footer ? (
              <View style={styles.footerWrap}>
                <DashedRule />
                <View style={styles.footer}>{item.footer}</View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The body slot's type (`.dkit-radio-body`), for bodies built from more than a string. */
export const radioBody = { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18.75 } as const;

const styles = StyleSheet.create({
  cards: { gap: 12 },
  card: { gap: 10, padding: 16, borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  // border 1 px + box-shadow 0 0 0 1px accent: one 2 px ring, the padding trimmed so the card keeps its size.
  checked: { borderWidth: 2, padding: 15 },
  dot: { position: "absolute", top: 14, right: 14, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dotOn: { width: 8, height: 8, borderRadius: 4 },
  media: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6, letterSpacing: -0.16 },
  body: radioBody,
  footerWrap: { marginTop: "auto", gap: 10 },
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
});
