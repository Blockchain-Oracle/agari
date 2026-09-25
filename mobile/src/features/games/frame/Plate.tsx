import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { FONT } from "~/theme";
import { Press } from "./Press";
import { useGamesTokens } from "./tokens";

interface PlateProps {
  children: ReactNode;
  /** `.gm-resume`: the vermilion-edged plate that offers a way back in. */
  resume?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** games.css `.gm-plate` (and `.gm-card`'s identical ground): radius 16, padding 20, gap 8, a hairline and a wash. */
export function Plate({ children, resume, onPress, accessibilityLabel, style }: PlateProps) {
  const { t } = useGamesTokens();
  const ground: ViewStyle = resume ? { borderColor: t.resumeBorder, backgroundColor: t.resumeBg } : { borderColor: t.cardBorder, backgroundColor: t.cardBg };
  if (!onPress) return <View style={[styles.plate, ground, style]}>{children}</View>;
  return (
    <Press onPress={onPress} accessibilityRole="link" accessibilityLabel={accessibilityLabel} style={(pressed) => [styles.plate, ground, pressed && !resume && { borderColor: t.cardHoverBorder }, style]}>
      {children}
    </Press>
  );
}

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

/** `.gm-plate-title`: Sora 700 14. */
export function PlateTitle({ children, style }: TextProps) {
  const { color } = useGamesTokens();
  return <Text style={[styles.title, { color: color.ink }, style]}>{children}</Text>;
}

/** `.gm-plate-body`: Inter 13 / 1.65, gray-400. */
export function PlateBody({ children, style }: TextProps) {
  const { color } = useGamesTokens();
  return <Text style={[styles.body, { color: color.inkSecondary }, style]}>{children}</Text>;
}

/** `.gm-plate-meta` / `.gm-plate-note`: mono 10 / 1.6, gray-500. */
export function PlateMeta({ children, style }: TextProps) {
  const { color } = useGamesTokens();
  return <Text style={[styles.meta, { color: color.inkMuted }, style]}>{children}</Text>;
}

/** `.gm-resume-cta`: mono 11, 0.06em, uppercase, vermilion, 4 px above. */
export function ResumeCta({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const { color } = useGamesTokens();
  return <Text style={[styles.cta, { color: color.accent }, style]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  plate: { flexDirection: "column", gap: 8, borderRadius: 16, padding: 20, borderWidth: 1 },
  title: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 21.45 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  cta: { alignSelf: "flex-start", marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66 },
});
