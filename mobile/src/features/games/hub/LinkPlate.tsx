import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGames } from "~/features/games/shell";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's `.gm-plate.gm-link-plate` (and `.gm-resume`): a title, one line and a call, the whole plate one
 * touch target. `tone="accent"` is the resume plate that must beat starting something new.
 */
export function LinkPlate({ title, body, cta, href, tone = "plain" }: {
  title: string;
  body: string;
  cta: string;
  href: Href;
  tone?: "plain" | "accent";
}) {
  const { color } = useTheme();
  const { feedback } = useGames();
  const accent = tone === "accent";
  return (
    <Pressable
      onPress={() => {
        feedback("tap");
        router.push(href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityHint={cta}
      style={({ pressed }) => [
        styles.plate,
        {
          backgroundColor: accent ? color.accentWash : color.surface1,
          borderColor: accent ? color.accentDim : color.hairline,
        },
        pressed && { opacity: 0.86 },
      ]}
    >
      <Text style={[TYPE.title, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{body}</Text>
      <View style={styles.cta}>
        <Text style={[styles.ctaText, { color: color.accent }]}>{cta.toUpperCase()}</Text>
        <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={12} tintColor={color.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 16, gap: 6 },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  ctaText: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 1.2 },
});
