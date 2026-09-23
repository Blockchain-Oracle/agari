import { StyleSheet, TextInput, View } from "react-native";
import { SENSEI_UI } from "@/features/sensei/copy";
import { Button } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** web's `.sensei-drawer-input`: the question field and "Ask", disabled while a reply is on its way. */
export function SenseiComposer({ value, onChange, onSend, busy }: { value: string; onChange: (text: string) => void; onSend: () => void; busy: boolean }) {
  const { color } = useTheme();
  const ready = !busy && value.trim().length > 0;
  return (
    <View style={[styles.row, { borderTopColor: color.hairline }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={SENSEI_UI.placeholder}
        placeholderTextColor={color.inkMuted}
        accessibilityLabel={SENSEI_UI.placeholder}
        returnKeyType="send"
        onSubmitEditing={() => ready && onSend()}
        style={[TYPE.body, styles.input, { color: color.ink, backgroundColor: color.surface1, borderColor: color.hairline }]}
      />
      <Button label={SENSEI_UI.send} onPress={onSend} disabled={!ready} loading={busy} block={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14 },
});
