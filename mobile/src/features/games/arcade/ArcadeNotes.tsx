import type { ArcadeGame } from "@agari/core/games/arcade";
import { ARCADE } from "@/features/games/arcade/copy";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Card, haptic } from "~/components/kit";
import { gameEntry } from "~/features/games/shell";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { ARCADE_NATIVE } from "./copy";

/**
 * The pieces of web's `ArcadeStage.tsx` around the screen: the readout under it (the mode's mark, what to do,
 * how to steer), the calm switch (`.ar-calm`) and the honesty note (`.ar-note`).
 */
export function ArcadeReadout({ game }: { game: ArcadeGame }) {
  const { color } = useTheme();
  const icon = gameEntry(game).nav.icon;
  return (
    <View style={styles.readout}>
      <View style={[styles.readoutIcon, { backgroundColor: color.accentWash }]}>
        <SymbolView name={icon} size={18} tintColor={color.accent} />
      </View>
      <View style={styles.readoutText}>
        <Text style={[styles.readoutName, { color: color.ink }]}>{ARCADE.games[game].readout.toUpperCase()}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{ARCADE_NATIVE.control[game]}</Text>
      </View>
    </View>
  );
}

export function CalmSwitch({ calm, disabled, onChange }: { calm: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  const { color } = useTheme();
  const flip = () => {
    if (disabled) return;
    haptic.select();
    onChange(!calm);
  };
  return (
    <Card>
      <Pressable
        onPress={flip}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={ARCADE_NATIVE.calmA11y}
        accessibilityHint={ARCADE.calm.hint}
        accessibilityState={{ checked: calm, disabled }}
        style={[styles.calm, disabled && { opacity: 0.5 }]}
      >
        <View style={styles.calmText}>
          <Text style={[styles.calmLabel, { color: color.ink }]}>{ARCADE.calm.label}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{ARCADE.calm.hint}</Text>
        </View>
        <Switch
          value={calm}
          disabled={disabled}
          onValueChange={(next) => {
            haptic.select();
            onChange(next);
          }}
          trackColor={{ true: color.accent, false: color.surface3 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
    </Card>
  );
}

export function ArcadeNote() {
  const { color } = useTheme();
  return (
    <Card style={styles.note}>
      <Text style={[styles.noteK, { color: color.inkMuted }]}>{ARCADE.note.label.toUpperCase()}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{ARCADE.note.body}</Text>
      <Text style={[styles.honesty, { color: color.inkMuted }]}>{ARCADE.honesty}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: "row", alignItems: "center", gap: 12 },
  readoutIcon: { width: 36, height: 36, borderRadius: RADIUS.md + 2, alignItems: "center", justifyContent: "center" },
  readoutText: { flex: 1, gap: 2 },
  readoutName: { fontFamily: FONT.dataStrong, fontSize: 17, letterSpacing: 1 },
  calm: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  calmText: { flex: 1, gap: 2 },
  calmLabel: { fontFamily: FONT.heading, fontSize: 14 },
  note: { gap: 6 },
  noteK: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.2 },
  honesty: { fontFamily: FONT.data, fontSize: 11 },
});
