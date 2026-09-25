import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SENSEI_UI } from "@/features/sensei/copy";
import { FONT, useTheme } from "~/theme";
import { senseiTokens } from "~/theme/web/explore/sensei";

/** web's `.sensei-drawer-input`: the pill field and the vermilion "Ask" pill, dimmed while there is nothing to send. */
export function SenseiComposer({ value, onChange, onSend, busy }: { value: string; onChange: (text: string) => void; onSend: () => void; busy: boolean }) {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  const [focused, setFocused] = useState(false);
  const ready = !busy && value.trim().length > 0;
  return (
    <View style={[styles.row, { borderTopColor: t.rule }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={SENSEI_UI.placeholder}
        placeholderTextColor={color.inkMuted}
        accessibilityLabel={SENSEI_UI.placeholder}
        returnKeyType="send"
        onSubmitEditing={() => ready && onSend()}
        style={[styles.input, { color: t.inputInk, backgroundColor: t.inputFill, borderColor: focused ? t.inputFocus : t.inputBorder }]}
      />
      <Pressable
        onPress={onSend}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        style={[styles.send, { backgroundColor: color.accent, opacity: ready ? 1 : 0.4 }]}
      >
        <Text style={[styles.sendText, { color: t.sendInk }]}>{SENSEI_UI.send}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  input: { flex: 1, height: 46, borderWidth: 1, borderRadius: 999, paddingHorizontal: 15, fontFamily: FONT.body, fontSize: 14 },
  send: { height: 46, borderRadius: 999, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  sendText: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
});
