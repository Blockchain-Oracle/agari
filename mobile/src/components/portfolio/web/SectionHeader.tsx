import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { useTheme } from "~/theme";

interface SectionHeaderProps {
  index: string;
  title: string;
  eyebrow?: string;
  desc?: string;
  aside?: ReactNode;
}

/** web `components/chrome/SectionHeader`: "01 · Title", a hairline under it (border-b pb-2), the aside on the right. */
export function SectionHeader({ index, title, eyebrow, desc, aside }: SectionHeaderProps) {
  const { color } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: color.hairline }]}>
      <View style={styles.row}>
        <View style={styles.lead}>
          <Text style={[WEB_TYPE.labelMicro, { color: color.inkMuted }]}>{index}</Text>
          <Text style={[WEB_TYPE.body, styles.dot, { color: color.inkMuted }]} accessibilityElementsHidden>
            ·
          </Text>
          <Text style={[WEB_TYPE.title, styles.title, { color: color.ink }]} accessibilityRole="header">
            {title}
          </Text>
          {eyebrow ? <Text style={[WEB_TYPE.labelMicro, { color: color.inkSecondary }]}>{eyebrow}</Text> : null}
        </View>
        {aside}
      </View>
      {desc ? <Text style={[WEB_TYPE.caption, styles.desc, { color: color.inkSecondary }]}>{desc}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: 1, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  lead: { flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 1 },
  dot: { lineHeight: 24 },
  title: { flexShrink: 1 },
  desc: { marginTop: 4 },
});
