import { formatCadence } from "@agari/core/copy";
import { AGENT_CADENCES_SEC, AGENT_PERSONA_MAX_CHARS, AGENT_POSTURES, describeSpec, POSTURES, type AgentPosture } from "@agari/core/strategies";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { draftSpec, type StudioDraft } from "@/features/strategies/studio-draft";
import { FONT } from "~/theme";
import { FieldLabel, Sensei, ST, StratInput, useStrat } from "../ui";
import { Chip } from "./parts";
import type { SetDraft } from "./StudioForm";

const S = STRATEGIES.studio;
const A = STRATEGIES.studio.agent;
const RISK = STRATEGIES.desk.risk;

function toggleCadence(list: number[], cadence: number): number[] {
  const next = list.includes(cadence) ? list.filter((c) => c !== cadence) : [...list, cadence];
  return next.length === 0 ? list : next.sort((a, b) => a - b);
}

/** web's features/strategies/StudioAgentFields.tsx — step 02 for an agent: the brief, the gate posture, the cadences. */
export function StudioAgentFields({ form, setForm, asset }: { form: StudioDraft; setForm: SetDraft; asset: string }) {
  const { t, color } = useStrat();
  const persona = form.persona;
  const hint = [ST.mono10, styles.mt6, { color: t.ink(0.3) }];
  return (
    <View style={styles.space20}>
      <View>
        <View style={styles.personaHead}>
          <FieldLabel style={styles.mb0}>{A.persona}</FieldLabel>
          <Text style={[ST.mono10, { color: persona.length >= AGENT_PERSONA_MAX_CHARS ? t.vermilion : t.ink(0.4) }]}>{A.personaCount(persona.length, AGENT_PERSONA_MAX_CHARS)}</Text>
        </View>
        <StratInput
          multiline
          value={persona}
          onChangeText={(v) => setForm((f) => ({ ...f, persona: v.slice(0, AGENT_PERSONA_MAX_CHARS) }))}
          placeholder={A.personaPlaceholder}
          maxLength={AGENT_PERSONA_MAX_CHARS}
          accessibilityLabel={A.persona}
          style={styles.persona}
        />
        <Text style={hint}>{A.personaHint}</Text>
        {persona !== A.defaultPersona ? <Sensei label={A.restorePersona} onPress={() => setForm((f) => ({ ...f, persona: A.defaultPersona }))} style={styles.mt12} /> : null}
      </View>

      <View>
        <FieldLabel>{A.posture}</FieldLabel>
        <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel={A.posture}>
          {AGENT_POSTURES.map((p: AgentPosture) => {
            const rules = POSTURES[p];
            const on = form.posture === p;
            return (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setForm((f) => ({ ...f, posture: p }))}
                style={[styles.mode, on ? { borderColor: t.vermilionA(0.6), backgroundColor: t.vermilionA(0.08) } : { borderColor: t.ink(0.09), backgroundColor: t.ink(0.015) }]}
              >
                <Text style={[styles.modeLabel, { color: on ? color.ink : t.ink(0.6) }]}>{RISK[p][0]}</Text>
                <Text style={[styles.modeDetail, { color: t.ink(0.3) }]}>{A.postureDetail(Math.round(rules.minConfidence * 100), rules.maxPriceCents, rules.breakerLosses)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={hint}>{A.postureHint}</Text>
      </View>

      <View>
        <FieldLabel>{A.cadences}</FieldLabel>
        <View style={styles.chips} accessibilityLabel={A.cadences}>
          {AGENT_CADENCES_SEC.map((c) => (
            <Chip key={c} label={formatCadence(c)} on={form.cadences.includes(c)} onPress={() => setForm((f) => ({ ...f, cadences: toggleCadence(f.cadences, c) }))} />
          ))}
        </View>
        <Text style={hint}>{A.cadencesHint}</Text>
      </View>

      <View style={[styles.plain, { borderColor: color.hairline, backgroundColor: t.ink(0.02) }]}>
        <Text style={[ST.micro, styles.mb6, { color: color.accent }]}>{S.plain}</Text>
        <Text style={[styles.plainText, { color: color.inkSecondary }]}>{describeSpec(draftSpec(form), asset)}</Text>
        <View style={styles.honesty}>
          {A.honesty.map((line) => (
            <Text key={line} style={[ST.mono10, { color: t.ink(0.4) }]}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  space20: { gap: 20 },
  personaHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  mb0: { marginBottom: 0 },
  persona: { minHeight: 131 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  mb6: { marginBottom: 6 },
  modes: { flexDirection: "row", gap: 6 },
  mode: { flex: 1, minWidth: 0, borderRadius: 6, borderWidth: 1, padding: 8 },
  modeLabel: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 17.6 },
  modeDetail: { marginTop: 2, fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  plain: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  plainText: { fontFamily: FONT.body, fontSize: 13.125, lineHeight: 18.047 },
  honesty: { marginTop: 8, gap: 2 },
});
