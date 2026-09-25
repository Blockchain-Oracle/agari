import type { ArcadeGame } from "@agari/core/games/arcade";
import { ARCADE } from "@/features/games/arcade/copy";
import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGamesTokens } from "~/features/games/frame";
import { gameEntry } from "~/features/games/shell";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { ARCADE_NATIVE } from "./copy";
import { useArcadeTokens } from "./palette";

/**
 * The pieces of web's `ArcadeStage.tsx` around the screen: the readout under it (`.ar-readout` — the mode's mark,
 * what to do, how to steer), the calm checkbox (`.ar-note.ar-calm`) and the honesty note (`.ar-note`).
 */
export function ArcadeReadout({ game }: { game: ArcadeGame }) {
  const { t, color } = useGamesTokens();
  const Icon = gameEntry(game).nav.icon;
  return (
    <View style={styles.readout}>
      <View style={[styles.readoutIcon, { backgroundColor: t.iconWash }]}>
        <Icon size={18} color={color.accent} strokeWidth={2} />
      </View>
      <View style={styles.grow}>
        <Text style={[styles.readoutName, { color: color.ink }]}>{ARCADE.games[game].readout.toUpperCase()}</Text>
        <Text style={[styles.readoutHint, { color: color.inkSecondary }]}>{ARCADE_NATIVE.control[game]}</Text>
      </View>
    </View>
  );
}

/** `.ar-note`'s mono lines: the board's foot (10 / 1.6) and the note's key (9, 0.12em, uppercase). */
export function NoteText({ kind, children }: { kind: "foot" | "key" | "honesty"; children: ReactNode }) {
  const { color } = useGamesTokens();
  return <Text style={[kind === "key" ? styles.key : kind === "honesty" ? styles.honesty : styles.foot, { color: color.inkMuted }]}>{children}</Text>;
}

export function CalmSwitch({ calm, disabled, onChange }: { calm: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  const { t, color } = useGamesTokens();
  const a = useArcadeTokens();
  return (
    <Pressable
      onPress={() => onChange(!calm)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={ARCADE_NATIVE.calmA11y}
      accessibilityHint={ARCADE.calm.hint}
      accessibilityState={{ checked: calm, disabled }}
      style={[NOTE.note, styles.calm, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
    >
      <View style={[styles.box, calm ? { backgroundColor: color.accent, borderColor: color.accent } : { backgroundColor: a.boxFill, borderColor: a.boxBorder }, disabled && styles.off]}>
        {calm ? <Check size={10} color={a.boxTick} strokeWidth={4} /> : null}
      </View>
      <View style={styles.calmText}>
        <Text style={[styles.calmLabel, { color: color.ink }]}>{ARCADE.calm.label}</Text>
        <Text style={[styles.calmHint, { color: color.inkSecondary }]}>{ARCADE.calm.hint}</Text>
      </View>
    </Pressable>
  );
}

export function ArcadeNote() {
  const { t, color } = useGamesTokens();
  return (
    <View style={[NOTE.note, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
      <NoteText kind="key">{ARCADE.note.label.toUpperCase()}</NoteText>
      <Text style={[styles.body, { color: color.inkSecondary }]}>{ARCADE.note.body}</Text>
      <NoteText kind="honesty">{ARCADE.honesty}</NoteText>
    </View>
  );
}

/** `.ar-note`: radius 14, 14 × 16 padding, gap 6, the games card's hairline and wash. */
export const NOTE = StyleSheet.create({
  note: { flexDirection: "column", gap: 6, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1 },
});

const styles = StyleSheet.create({
  readout: { flexDirection: "row", alignItems: "center", gap: 12 },
  readoutIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  readoutName: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, letterSpacing: 1.32 },
  readoutHint: { marginTop: 4, fontFamily: FONT.body, fontSize: 12, lineHeight: 16.8 },
  foot: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  key: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08 },
  honesty: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.4 },
  body: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.8 },
  calm: { gap: 10 },
  box: { marginTop: 3, width: 13, height: 13, borderRadius: 3, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.5 },
  calmText: { gap: 2 },
  calmLabel: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  calmHint: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
});
