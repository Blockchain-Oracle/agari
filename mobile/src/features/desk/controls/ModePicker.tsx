import { Hand, Zap } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { FONT } from "~/theme";
import { IconTile, RadioCards, useDeskTheme } from "../kit";

export type LiveMode = "ask_first" | "on_its_own";

/** web's ModePicker.tsx: the two live modes as radio cards under a `.st-label`; practice is never picked here. */
export function ModePicker({ value, onChange, label }: { value: LiveMode; onChange: (mode: LiveMode) => void; label: string }) {
  const { color } = useDeskTheme();
  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: color.inkMuted }]}>{label}</Text>
      <RadioCards
        value={value}
        onChange={onChange}
        label={label}
        items={(["ask_first", "on_its_own"] as const).map((mode) => ({
          value: mode,
          media: <IconTile icon={mode === "ask_first" ? Hand : Zap} level={mode === "ask_first" ? "careful" : "loose"} />,
          title: DESK.modes[mode],
          body: DESK.modeNote[mode],
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  label: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32, textTransform: "uppercase" },
});
