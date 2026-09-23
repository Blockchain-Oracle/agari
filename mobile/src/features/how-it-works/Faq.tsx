import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FAQS, type Faq as FaqItem } from "@/features/how-it-works/content";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { haptic } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { SectionLabel } from "./Blocks";
import { GLYPH } from "./symbols";

function Chevron({ open }: { open: boolean }) {
  const { color } = useTheme();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 200 });
  }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <SymbolView name={GLYPH.chevronDown} size={14} tintColor={color.inkMuted} />
    </Animated.View>
  );
}

function Row({ faq, open, onToggle }: { faq: FaqItem; open: boolean; onToggle: () => void }) {
  const { color } = useTheme();
  return (
    <Animated.View layout={LinearTransition.duration(220)} style={[styles.item, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={faq.question}
        style={styles.question}
      >
        <Text style={[TYPE.bodyStrong, styles.questionText, { color: color.ink }]}>{faq.question}</Text>
        <Chevron open={open} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={styles.answer}>
          <Text style={[TYPE.body, { color: color.inkMuted }]}>{faq.answer}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** web Faq.tsx: the accordion, one row open at a time, the chevron turning. */
export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <SectionLabel title={HOW_IT_WORKS.sections.faq} glyph={GLYPH.help} />
      <View style={styles.list}>
        {FAQS.map((faq, index) => (
          <Row
            key={faq.question}
            faq={faq}
            open={open === index}
            onToggle={() => {
              haptic.select();
              setOpen(open === index ? null : index);
            }}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  question: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16, paddingVertical: 12 },
  questionText: { flex: 1 },
  answer: { paddingHorizontal: 16, paddingBottom: 16 },
});
