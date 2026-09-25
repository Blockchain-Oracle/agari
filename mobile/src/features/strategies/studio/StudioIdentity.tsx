import { PRESETS } from "@agari/core/strategies";
import { StyleSheet, Text, View } from "react-native";
import type { StudioDraft } from "@/features/strategies/studio-draft";
import { Button, Field } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { Choice } from "./Choice";

/** What each approach does, in web's StudioForm words. */
const APPROACH_BODY = {
  agent: "An AI reads the opening price, recent move and order books, then explains its call. Hard limits still decide what it may trade.",
  momentum: "A fixed rule follows the current EMA price away from each Window’s opening print. No AI model is used.",
  reversion: "A fixed rule bets against the current EMA move away from each Window’s opening print, expecting it to pull back. No AI model is used.",
  mirror: "One named wallet is the signal. When it takes a side on a Window and is still net on it, this takes the same side — after their order landed, at the book’s price then. No AI model is used.",
} as const;

export type SetDraft = (update: (f: StudioDraft) => StudioDraft) => void;

export function newPortraitSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `agari-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Step 01 of web's StudioForm: name, trading approach, portrait. */
export function StudioIdentity({ form, setForm }: { form: StudioDraft; setForm: SetDraft }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <Field label="Agent name" value={form.name} maxLength={64} placeholder="Give your agent a name" onChangeText={(name) => setForm((f) => ({ ...f, name }))} />
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Trading approach</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {(["agent", "momentum", "reversion", "mirror"] as const).map((preset) => (
          <Choice key={preset} title={PRESETS[preset].name} body={APPROACH_BODY[preset]} on={form.preset === preset} onPress={() => setForm((f) => ({ ...f, preset }))} />
        ))}
      </View>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        Market scope: every live Window, 24/7 lanes included. The runner chooses eligible Windows.
      </Text>
      <Button label="Choose another portrait" variant="ghost" size="sm" block={false} icon={{ ios: "shuffle", android: "shuffle" }} onPress={() => setForm((f) => ({ ...f, portraitSeed: newPortraitSeed() }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  choices: { gap: 10 },
});
