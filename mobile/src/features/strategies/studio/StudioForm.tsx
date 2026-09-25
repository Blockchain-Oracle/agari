import { PRESETS } from "@agari/core/strategies";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import type { StudioDraft } from "@/features/strategies/studio-draft";
import { FieldLabel, Sensei, ST, StratInput, useStrat } from "../ui";
import { Body, Chip, Choice, Field, newPortraitSeed } from "./parts";
import { StudioAgentFields } from "./StudioAgentFields";
import { StudioMirrorFields } from "./StudioMirrorFields";

/** What each approach does, in the builder's own words (web StudioForm APPROACH_BODY). */
const APPROACH_BODY = {
  agent: "An AI reads the opening price, recent move and order books, then explains its call. Hard limits still decide what it may trade.",
  momentum: "A fixed rule follows the current EMA price away from each Window’s opening print. No AI model is used.",
  reversion: "A fixed rule bets against the current EMA move away from each Window’s opening print, expecting it to pull back. No AI model is used.",
  mirror: "One named wallet is the signal. When it takes a side on a Window and is still net on it, this takes the same side — after their order landed, at the book’s price then. No AI model is used.",
} as const;

const S = STRATEGIES.studio;
export type SetDraft = (update: (f: StudioDraft) => StudioDraft) => void;

/** web's features/strategies/StudioForm.tsx: the three editable panels (the test read is CreatorStudio's own). */
export function StudioForm({ form, setForm, symbol, asset, houseRunner, step }: {
  form: StudioDraft; setForm: SetDraft; symbol: string; asset: string; houseRunner: string | null; step: number;
}) {
  const { color } = useStrat();
  if (step === 1) {
    return (
      <View style={styles.space24}>
        <Field label="Agent name">
          <StratInput value={form.name} maxLength={64} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="Give your agent a name" />
        </Field>
        <View>
          <FieldLabel>Trading approach</FieldLabel>
          <View style={styles.space12}>
            {(["agent", "momentum", "reversion", "mirror"] as const).map((preset) => (
              <Choice key={preset} title={PRESETS[preset].name} body={APPROACH_BODY[preset]} on={form.preset === preset} onPress={() => setForm((f) => ({ ...f, preset }))} />
            ))}
          </View>
        </View>
        <Body>Market scope: every live Window, 24/7 lanes included. The runner chooses eligible Windows.</Body>
        <Sensei label="Choose another portrait" onPress={() => setForm((f) => ({ ...f, portraitSeed: newPortraitSeed() }))} />
      </View>
    );
  }
  if (step === 2) {
    return (
      <View style={styles.space24}>
        {form.preset === "agent" ? (
          <StudioAgentFields form={form} setForm={setForm} asset={asset} />
        ) : form.preset === "mirror" ? (
          <StudioMirrorFields form={form} setForm={setForm} />
        ) : (
          <View>
            <FieldLabel>Minimum move from the opening price</FieldLabel>
            <View style={styles.chips}>
              {["0.1", "0.2", "0.5", "1"].map((value) => (
                <Chip key={value} label={`${value}%`} on={form.thresholdPct === value} onPress={() => setForm((f) => ({ ...f, thresholdPct: value }))} />
              ))}
            </View>
            <Body style={styles.mt12}>
              A move above this threshold may produce an UP call; a move below its negative may produce DOWN. The strategy waits when the move is smaller. Each Window is considered once.
            </Body>
          </View>
        )}
        <View style={[styles.limits, { borderTopColor: color.hairline }]}>
          <Text style={[ST.choiceTitle, styles.mb16, { color: color.ink }]}>Hard spending limits</Text>
          <View style={styles.space16}>
            <Field label={`${S.perTrade} (${symbol})`}>
              <StratInput keyboardType="decimal-pad" value={form.maxPerTrade} onChangeText={(maxPerTrade) => setForm((f) => ({ ...f, maxPerTrade }))} />
            </Field>
            <Field label={`${S.daily} (${symbol})`}>
              <StratInput keyboardType="decimal-pad" value={form.maxDaily} onChangeText={(maxDaily) => setForm((f) => ({ ...f, maxDaily }))} />
            </Field>
          </View>
          <Body style={styles.mt12}>At most two open positions per follower. Followers can set tighter limits and revoke permission. Creating an agent does not fund it.</Body>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.space24}>
      <View>
        <FieldLabel>Who runs it</FieldLabel>
        <View style={styles.space12}>
          {(["house", "self"] as const).map((hosting) => (
            <Choice
              key={hosting}
              title={hosting === "house" ? "Let Agari run it" : "Run your own bot"}
              body={
                hosting === "house"
                  ? houseRunner
                    ? "The hosted runner discovers your published strategy. A follower’s funded permission enables trading."
                    : "A house runner is not configured on this deployment."
                  : "Publish with the address of your own running bot. You operate its process and model credentials."
              }
              on={form.hosting === hosting}
              disabled={hosting === "house" && !houseRunner}
              onPress={() => setForm((f) => ({ ...f, hosting }))}
            />
          ))}
        </View>
        {form.hosting === "self" ? (
          <View style={styles.mt16}>
            <Field label="Runner wallet">
              <StratInput value={form.agent} autoCapitalize="none" autoCorrect={false} onChangeText={(agent) => setForm((f) => ({ ...f, agent }))} placeholder="0x…" />
            </Field>
          </View>
        ) : null}
      </View>
      <Field label={`Subscription fee (${symbol})`}>
        <StratInput keyboardType="decimal-pad" value={form.subFee} onChangeText={(subFee) => setForm((f) => ({ ...f, subFee }))} />
      </Field>
      <Body>The registry charges this fee to a follower on every subscription, including a resume or a limits change. Set 0 for free subscriptions.</Body>
      <Field label="Public playbook · optional">
        <StratInput multiline maxLength={4000} value={form.playbook} onChangeText={(playbook) => setForm((f) => ({ ...f, playbook }))} />
      </Field>
      <Body>Your name, brief, playbook and runner address are public. Keep secrets and private instructions out of them.</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  space24: { gap: 24 },
  space16: { gap: 16 },
  space12: { gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mb16: { marginBottom: 16 },
  limits: { borderTopWidth: 1, paddingTop: 20 },
});
