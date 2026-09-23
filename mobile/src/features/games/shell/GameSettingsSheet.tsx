import { useContext } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GAMES } from "@/features/games/copy";
import { ACCENT_CHOICES, ACCENT_LABELS, type MotionChoice } from "@/features/games/settings";
import { Button, Segmented } from "~/components/kit";
import { playSfx, setBgmVolume, setSfxVolume, useGameVolumes } from "~/games/audio";
import { fireFeedback } from "~/games/feedback";
import { SPACE, TYPE, useTheme } from "~/theme";
import { AccentPicker } from "./AccentPicker";
import { GamesContext } from "./context";
import { SheetHeader } from "./SheetHeader";
import { VolumeSlider } from "./VolumeSlider";

const MOTION_ORDER: readonly MotionChoice[] = ["system", "full", "reduced"];

/**
 * web's `GameSettingsSheet` as a native page sheet, reachable from the hub and every game header: the two
 * volume channels in one well (zero is that channel's mute), haptics, motion (system / full / reduced) and
 * the accent. Every change applies at once and stays on this device under web's own keys. Each switch
 * demonstrates itself: the effects slider clicks at its new level, haptics buzzes as it turns on.
 */
export function GameSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const games = useContext(GamesContext);
  const volumes = useGameVolumes();
  const words = GAMES.settings;
  if (!games) return null;
  const { settings, setHaptics, setMotion, setAccent, systemPrefersReduced, feedback } = games;

  const motionOptions = MOTION_ORDER.map((choice) => ({ value: choice, label: words.motion[choice] }));

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      {/* A native modal is its own window: the sliders' gestures need a root inside it. */}
      <GestureHandlerRootView style={[styles.root, { backgroundColor: color.ground }]}>
        <SheetHeader title={words.title} onClose={onClose} closeLabel={words.close} />
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{words.intro}</Text>

          <View style={[styles.well, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
            <VolumeSlider
              label={words.sfx.label}
              hint={words.sfx.hint}
              value={volumes.sfx}
              onChange={setSfxVolume}
              onRelease={() => playSfx("click")}
            />
            <View style={[styles.rule, { backgroundColor: color.hairline }]} />
            <VolumeSlider label={words.music.label} hint={words.music.hint} value={volumes.bgm} onChange={setBgmVolume} />
          </View>

          <View style={[styles.row, { borderBottomColor: color.hairline }]}>
            <View style={styles.text}>
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{words.haptics.label}</Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.haptics.hint}</Text>
            </View>
            <Switch
              value={settings.haptics}
              onValueChange={(on) => {
                setHaptics(on);
                if (on) fireFeedback("confirm", { haptics: true });
              }}
              accessibilityLabel={words.haptics.label}
              trackColor={{ true: color.accent, false: color.surface3 }}
            />
          </View>

          <View style={[styles.block, { borderBottomColor: color.hairline }]}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{words.motion.label}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.motion.hint}</Text>
            <Segmented
              label={words.motion.label}
              options={motionOptions}
              value={settings.motion}
              onChange={(choice) => {
                setMotion(choice);
                feedback("tap");
              }}
            />
            {settings.motion === "system" ? (
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                {systemPrefersReduced ? words.motion.systemOnHint : words.motion.systemOffHint}
              </Text>
            ) : null}
          </View>

          <View style={[styles.block, { borderBottomColor: color.hairline }]}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{GAMES.profile.accent}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{GAMES.profile.accentHint}</Text>
            <AccentPicker
              choices={ACCENT_CHOICES}
              labels={ACCENT_LABELS}
              value={settings.accent}
              onChange={(choice) => {
                setAccent(choice);
                feedback("tap");
              }}
            />
          </View>

          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.scope}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.credits}</Text>
          <Button label={words.close} onPress={onClose} />
        </ScrollView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: SPACE.gutter, gap: 18 },
  well: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 14 },
  rule: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
  block: { gap: 8, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth },
});
