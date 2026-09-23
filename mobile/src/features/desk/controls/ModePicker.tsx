import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { TYPE, useTheme } from "~/theme";
import { IconTile, RadioCards } from "../kit";

export type LiveMode = "ask_first" | "on_its_own";

/** web's ModePicker.tsx: the two live modes as radio cards; practice is never picked here, it is where every desk starts. */
export function ModePicker({ value, onChange, label }: { value: LiveMode; onChange: (mode: LiveMode) => void; label: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.block}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <RadioCards
        value={value}
        onChange={onChange}
        label={label}
        items={(["ask_first", "on_its_own"] as const).map((mode) => ({
          value: mode,
          media: <IconTile level={mode === "ask_first" ? "careful" : "loose"} icon={mode === "ask_first" ? { ios: "hand.raised", android: "front_hand" } : { ios: "bolt", android: "bolt" }} />,
          title: DESK.modes[mode],
          body: DESK.modeNote[mode],
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
});
