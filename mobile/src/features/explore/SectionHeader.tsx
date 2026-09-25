import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT, useTheme } from "~/theme";

interface Props {
  /** "01", "02" … — the numbered-section rhythm. */
  index: string;
  title: string;
  eyebrow?: string;
  desc?: string;
  aside?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * web's components/chrome/SectionHeader.tsx as production computes it: the micro index, a dot, the Sora title and an
 * optional eyebrow over a hairline, the caption under it. The label and caption render in Inter there (the data face
 * variable does not resolve on those spans), so they do here.
 */
export function SectionHeader({ index, title, eyebrow, desc, aside, style }: Props) {
  const { color } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: color.hairline }, style]}>
      <View style={styles.top}>
        <View style={styles.left}>
          <Text style={[styles.micro, { color: color.inkMuted }]}>{index}</Text>
          <Text style={[styles.dot, { color: color.inkMuted }]} accessibilityElementsHidden importantForAccessibility="no">
            ·
          </Text>
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {title}
          </Text>
          {eyebrow ? <Text style={[styles.micro, { color: color.inkSecondary }]}>{eyebrow}</Text> : null}
        </View>
        {aside}
      </View>
      {desc ? <Text style={[styles.desc, { color: color.inkSecondary }]}>{desc}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 8, borderBottomWidth: 1 },
  top: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  left: { flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 1, flexWrap: "wrap" },
  micro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  dot: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 23.4 },
  desc: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85, marginTop: 4 },
});
