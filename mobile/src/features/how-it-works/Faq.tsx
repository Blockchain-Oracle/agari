import { ChevronDown, CircleHelp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { FAQS } from "@/features/how-it-works/content";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { useTheme } from "~/theme";
import { hiwTokens } from "~/theme/web/explore/how-it-works";
import { Body, HIW_FONT, Label, Rise, Section } from "./Blocks";

/** web Faq.tsx: the accordion — one row open at a time, the chevron turning, the answer in gray-500. */
export function FaqSection() {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Section>
      <Label title={HOW_IT_WORKS.sections.faq} icon={CircleHelp} />
      <View style={styles.list}>
        {FAQS.map((faq, index) => {
          const isOpen = open === index;
          return (
            <Rise key={faq.question} baseMs={500 + index * 50}>
              <Animated.View layout={LinearTransition.duration(200)} style={[styles.item, { backgroundColor: t.card, borderColor: t.line }]}>
                <Pressable
                  onPress={() => setOpen(isOpen ? null : index)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={styles.q}
                >
                  <Text style={[styles.qText, { color: color.ink }]}>{faq.question}</Text>
                  <ChevronDown size={16} color={color.inkMuted} style={isOpen ? styles.turned : null} />
                </Pressable>
                {isOpen ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.a}>
                    <Body dim>{faq.answer}</Body>
                  </Animated.View>
                ) : null}
              </Animated.View>
            </Rise>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  q: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 20 },
  qText: { flex: 1, fontFamily: HIW_FONT.bold, fontSize: 14, lineHeight: 22.4 },
  turned: { transform: [{ rotate: "180deg" }] },
  a: { paddingHorizontal: 20, paddingBottom: 20 },
});
