import type { AccentChoice } from "@/features/games/settings";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";

/**
 * web's accent radio group (`.gm-seg-btn--accent`): four choices, each with its swatch. `default` has no fixed
 * colour, it is the address's own hue, so its swatch shows the three the others could be.
 */
export function AccentPicker({ choices, labels, value, onChange }: {
  choices: readonly AccentChoice[];
  labels: Readonly<Record<AccentChoice, string>>;
  value: AccentChoice;
  onChange: (choice: AccentChoice) => void;
}) {
  const { color } = useTheme();
  const swatch: Record<Exclude<AccentChoice, "default">, string> = { vermilion: color.accent, up: color.profit, down: color.loss };
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {choices.map((choice) => {
        const on = choice === value;
        return (
          <Pressable
            key={choice}
            onPress={() => onChange(choice)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={labels[choice]}
            style={[
              styles.option,
              { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline },
            ]}
          >
            {choice === "default" ? (
              <View style={styles.tri}>
                <View style={[styles.triPart, { backgroundColor: color.accent }]} />
                <View style={[styles.triPart, { backgroundColor: color.profit }]} />
                <View style={[styles.triPart, { backgroundColor: color.loss }]} />
              </View>
            ) : (
              <View style={[styles.dot, { backgroundColor: swatch[choice] }]} />
            )}
            <Text style={[styles.label, { color: on ? color.ink : color.inkSecondary }]} numberOfLines={1}>
              {labels[choice]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  tri: { width: 14, height: 14, borderRadius: 7, overflow: "hidden", flexDirection: "row" },
  triPart: { flex: 1 },
  label: { fontFamily: FONT.bodyStrong, fontSize: 14 },
});
