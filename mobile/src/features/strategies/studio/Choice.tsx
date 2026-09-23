import { Pressable, StyleSheet, Text } from "react-native";
import { haptic } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** web's .strat-choice: a selectable plate with a title and one line of what it means. */
export function Choice({ title, body, on, onPress, disabled }: { title: string; body: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={`${title}. ${body}`}
      style={[
        styles.choice,
        { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : color.surface1, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 4, minHeight: 44 },
});
