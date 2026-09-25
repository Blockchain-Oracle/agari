import { useContext } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { ACCENT_CHOICES, ACCENT_LABELS, type AccentChoice, type MotionChoice } from "@/features/games/settings";
import { playSfx, setBgmVolume, setSfxVolume, useGameVolumes } from "~/games/audio";
import { fireFeedback } from "~/games/feedback";
import { FONT } from "~/theme";
import { Cta } from "../frame/Cta";
import { GameModal } from "../frame/GameModal";
import { Range } from "../frame/Range";
import { Switch } from "../frame/Switch";
import { useGamesTokens } from "../frame/tokens";
import { GamesContext } from "./context";
import { Segment } from "./Segment";

const MOTION_ORDER: readonly MotionChoice[] = ["system", "full", "reduced"];

/**
 * web's `GameSettingsSheet` — Flicky's menu modal: a centred plate that scrolls inside itself and never takes more
 * than four fifths of the screen; the two volume sliders in one rounded well (zero is that channel's mute), then
 * haptics, motion and the accent, the scope and credits lines, and one close. Each switch demonstrates itself.
 */
export function GameSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, color } = useGamesTokens();
  const games = useContext(GamesContext);
  const volumes = useGameVolumes();
  const words = GAMES.settings;
  if (!games) return null;
  const { settings, setHaptics, setMotion, setAccent, systemPrefersReduced, feedback } = games;
  const hint = [styles.hint, { color: color.inkSecondary }];
  const label = [styles.label, { color: color.ink }];

  return (
    <GameModal open={open} onClose={onClose} closeLabel={words.close} scroll>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {words.title}
      </Text>
      <Text style={hint}>{words.intro}</Text>

      <View style={styles.settings}>
        <View style={[styles.block, { backgroundColor: t.setBlock }]}>
          <View style={styles.stack}>
            <View style={styles.text}>
              <Text style={label}>{words.sfx.label}</Text>
              <Text style={hint}>{words.sfx.hint}</Text>
            </View>
            <Range label={words.sfx.label} value={volumes.sfx} onChange={setSfxVolume} onRelease={() => playSfx("click")} />
          </View>
          <View style={styles.stack}>
            <View style={styles.text}>
              <Text style={label}>{words.music.label}</Text>
              <Text style={hint}>{words.music.hint}</Text>
            </View>
            <Range label={words.music.label} value={volumes.bgm} onChange={setBgmVolume} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.text, styles.grow]}>
            <Text style={label}>{words.haptics.label}</Text>
            <Text style={hint}>{words.haptics.hint}</Text>
          </View>
          <Switch
            label={words.haptics.label}
            value={settings.haptics}
            onChange={(on) => {
              setHaptics(on);
              if (on) fireFeedback("confirm", { haptics: true });
            }}
          />
        </View>

        <View style={styles.stack}>
          <View style={styles.text}>
            <Text style={label}>{words.motion.label}</Text>
            <Text style={hint}>{words.motion.hint}</Text>
          </View>
          <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel={words.motion.label}>
            {MOTION_ORDER.map((choice) => (
              <Segment
                key={choice}
                label={words.motion[choice]}
                on={settings.motion === choice}
                onPress={() => {
                  setMotion(choice);
                  feedback("tap");
                }}
              />
            ))}
          </View>
          {settings.motion === "system" ? <Text style={hint}>{systemPrefersReduced ? words.motion.systemOnHint : words.motion.systemOffHint}</Text> : null}
        </View>

        <View style={styles.stack}>
          <View style={styles.text}>
            <Text style={label}>{GAMES.profile.accent}</Text>
            <Text style={hint}>{GAMES.profile.accentHint}</Text>
          </View>
          <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel={GAMES.profile.accent}>
            {ACCENT_CHOICES.map((choice: AccentChoice) => (
              <Segment
                key={choice}
                label={ACCENT_LABELS[choice]}
                accent={choice}
                on={settings.accent === choice}
                onPress={() => {
                  setAccent(choice);
                  feedback("tap");
                }}
              />
            ))}
          </View>
        </View>

        <Text style={[styles.scope, { color: color.inkMuted }]}>{words.scope}</Text>
        <Text style={[styles.scope, { color: color.inkMuted }]}>{words.credits}</Text>
        <Cta label={words.close} onPress={onClose} />
      </View>
    </GameModal>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 35.2, paddingRight: 24 },
  settings: { gap: 14 },
  block: { gap: 12, padding: 12, borderRadius: 16 },
  stack: { gap: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  text: { gap: 3 },
  grow: { flex: 1 },
  label: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  hint: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18.6 },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  scope: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
