import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { useReelTokens } from "./tokens";

/**
 * take.css, the grammar every social card in the reel shares (the take, "you hold it", your desk): the author row
 * with its badge, the call chip, the voice that fills the middle, and the foot with its call to action.
 */
export function TakeAuthor({ lead, name, onName, meta, badge, backed }: { lead?: ReactNode; name: string; onName?: () => void; meta: ReactNode; badge: string; backed?: boolean }) {
  const t = useReelTokens();
  const nameText = (
    <Text style={[styles.name, { color: t.ink85 }]} numberOfLines={1}>
      {name}
    </Text>
  );
  return (
    <View style={styles.author}>
      <View style={styles.ident}>
        {lead}
        <View style={styles.shrink}>
          {onName ? (
            <Pressable onPress={onName} accessibilityRole="link" hitSlop={6}>
              {nameText}
            </Pressable>
          ) : (
            nameText
          )}
          <Text style={[styles.meta, { color: t.ink35 }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
      <Text style={[styles.badge, backed ? { borderColor: t.v40, backgroundColor: t.v08, color: t.vermilion } : { borderColor: t.ink12, color: t.ink45 }]}>{badge.toUpperCase()}</Text>
    </View>
  );
}

/** `.take-chip-row` + `.take-chip`: the vermilion-edged mono pill that states the call. */
export function TakeChip({ children }: { children: ReactNode }) {
  const t = useReelTokens();
  return (
    <View style={styles.chipRow}>
      <View style={[styles.chip, { borderColor: t.v25, backgroundColor: t.v05 }]}>{children}</View>
    </View>
  );
}

/** `.take-voice` + `.take-caption` (or `.quiet` for a take with no note). */
export function TakeVoice({ children, quiet }: { children: ReactNode; quiet?: boolean }) {
  const t = useReelTokens();
  return (
    <View style={styles.voice}>
      <Text style={quiet ? [styles.quiet, { color: t.ink45 }] : [styles.caption, { color: t.ink }]}>{children}</Text>
    </View>
  );
}

/** `.take-cta`: the card's one way out, a hairline slab that warms to vermilion while pressed. */
export function TakeCta({ label, onPress, edge, style }: { label: string; onPress: () => void; edge?: "vermilion"; style?: object }) {
  const t = useReelTokens();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="link"
      style={({ pressed }) => [styles.cta, { borderColor: pressed ? t.v50 : edge ? t.v45 : t.ink15, backgroundColor: t.ink02 }, style]}
    >
      {({ pressed }) => <Text style={[styles.ctaText, { color: pressed ? t.ink : t.ink85 }]}>{label}</Text>}
    </Pressable>
  );
}

/** hedge.css `.hc-foot`: the reel ink's small print under a holding or desk card. */
export function TakeFootNote({ children }: { children: string }) {
  const t = useReelTokens();
  return <Text style={[styles.footNote, { color: t.ink45 }]}>{children}</Text>;
}

export const takeStyles = StyleSheet.create({
  foot: { zIndex: 10, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24 },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6 },
});

const styles = StyleSheet.create({
  author: { zIndex: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 20, paddingHorizontal: 20 },
  ident: { flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  shrink: { flexShrink: 1, minWidth: 0 },
  name: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26 },
  badge: { flexShrink: 0, borderRadius: 9999, borderWidth: 1, overflow: "hidden", paddingVertical: 4, paddingHorizontal: 12, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26 },
  chipRow: { zIndex: 10, marginTop: 20, paddingHorizontal: 20, flexDirection: "row" },
  chip: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 9999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14 },
  voice: { zIndex: 10, flex: 1, minHeight: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  caption: { flex: 1, fontFamily: FONT.heading, fontSize: 30, lineHeight: 33.6, letterSpacing: -0.6 },
  quiet: { flex: 1, fontFamily: FONT.headingRegular, fontSize: 24, lineHeight: 33, fontStyle: "italic" },
  cta: { borderRadius: 16, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  ctaText: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  footNote: { marginTop: 10, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.36 },
});
