import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT } from "~/theme";
import { useGamesTokens } from "./tokens";

/** games.css `.gm-eyebrow`: mono 11, 0.14em, uppercase, vermilion, 12 below. */
export function Eyebrow({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const { color } = useGamesTokens();
  return (
    <View style={style}>
      <Text style={[styles.eyebrow, { color: color.accent }]}>{children.toUpperCase()}</Text>
    </View>
  );
}

/** yosuku `.page-title` at 402 px (Sora 800, 45/42.3, −0.05em) with its vermilion full stop. */
export function PageTitle({ children }: { children: string }) {
  const { color } = useGamesTokens();
  return (
    <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
      {children}
      <Text style={{ color: color.accent }}>.</Text>
    </Text>
  );
}

/** `.gm-hero`: eyebrow, the page title, an optional `.gm-intro`, then 40 px before the first section. */
export function PageHero({ eyebrow, title, intro, children, style }: { eyebrow: string; title: string; intro?: string; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { color } = useGamesTokens();
  return (
    <View style={[styles.hero, style]}>
      <Eyebrow style={styles.eyebrowGap}>{eyebrow}</Eyebrow>
      <PageTitle>{title}</PageTitle>
      {intro ? <Text style={[styles.intro, { color: color.inkSecondary }]}>{intro}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 40 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54 },
  eyebrowGap: { marginBottom: 12 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 45, lineHeight: 46, letterSpacing: -2.25, paddingTop: 2 },
  intro: { marginTop: 16, fontFamily: FONT.body, fontSize: 14, lineHeight: 23.8 },
});
