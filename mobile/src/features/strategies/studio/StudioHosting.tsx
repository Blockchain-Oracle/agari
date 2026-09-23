import { StyleSheet, Text, TextInput, View } from "react-native";
import type { StudioDraft } from "@/features/strategies/studio-draft";
import { Field } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { AmountInput } from "../AmountInput";
import { Choice } from "./Choice";
import type { SetDraft } from "./StudioIdentity";

/** Step 04 of web's StudioForm: who runs it, the subscription fee and the optional public playbook. */
export function StudioHosting({ form, setForm, symbol, houseRunner }: { form: StudioDraft; setForm: SetDraft; symbol: string; houseRunner: string | null }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Who runs it</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        <Choice
          title="Let Agari run it"
          body={houseRunner ? "The hosted runner discovers your published strategy. A follower’s funded permission enables trading." : "A house runner is not configured on this deployment."}
          on={form.hosting === "house"}
          disabled={!houseRunner}
          onPress={() => setForm((f) => ({ ...f, hosting: "house" }))}
        />
        <Choice
          title="Run your own bot"
          body="Publish with the address of your own running bot. You operate its process and model credentials."
          on={form.hosting === "self"}
          onPress={() => setForm((f) => ({ ...f, hosting: "self" }))}
        />
      </View>
      {form.hosting === "self" ? (
        <Field label="Runner wallet" value={form.agent} placeholder="Your bot's Solana address" onChangeText={(agent) => setForm((f) => ({ ...f, agent: agent.trim() }))} />
      ) : null}
      <AmountInput label="Subscription fee" symbol={symbol} value={form.subFee} onChange={(subFee) => setForm((f) => ({ ...f, subFee }))} />
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        The registry charges this fee to a follower on every subscription, including a resume or a limits change. Set 0 for free subscriptions.
      </Text>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Public playbook · optional</Text>
      <TextInput
        value={form.playbook}
        onChangeText={(playbook) => setForm((f) => ({ ...f, playbook }))}
        maxLength={4000}
        multiline
        accessibilityLabel="Public playbook"
        placeholderTextColor={color.inkMuted}
        placeholder="Plain text, published in the open"
        style={[styles.area, { color: color.ink, borderColor: color.hairline, backgroundColor: color.surface1 }]}
      />
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        Your name, brief, playbook and runner address are public. Keep secrets and private instructions out of them.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  choices: { gap: 8 },
  area: { minHeight: 110, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, fontFamily: FONT.body, fontSize: 15, textAlignVertical: "top" },
});
