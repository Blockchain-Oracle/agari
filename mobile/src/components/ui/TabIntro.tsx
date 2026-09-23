import { StyleSheet, Text, View } from "react-native";
import { SPACE, TYPE, useTheme } from "@/theme";

/** A tab's heading and web's one-line purpose for it (nav-items.ts), above its content. */
export function TabIntro({ title, line }: { title: string; line: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.intro}>
      <Text style={[TYPE.headline, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ intro: { gap: 4, paddingHorizontal: SPACE.gutter, paddingTop: 8 } });
