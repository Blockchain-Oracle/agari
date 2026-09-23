import { formatCadence } from "@agari/core/copy";
import {
  AGENT_CADENCES_SEC,
  AGENT_PERSONA_MAX_CHARS,
  AGENT_POSTURES,
  describeSpec,
  MIRROR_WITHIN_MAX_SEC,
  MIRROR_WITHIN_MIN_SEC,
  POSTURES,
} from "@agari/core/strategies";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { draftSpec, type StudioDraft } from "@/features/strategies/studio-draft";
import { Button, Chips, Field, haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { AmountInput } from "../AmountInput";
import { Choice } from "./Choice";
import type { SetDraft } from "./StudioIdentity";

const S = STRATEGIES.studio;
const A = S.agent;
const RISK = STRATEGIES.desk.risk;
const WITHIN_CHOICES = [60, 120, 300, 900] as const;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function toggleCadence(list: number[], cadence: number): number[] {
  const next = list.includes(cadence) ? list.filter((c) => c !== cadence) : [...list, cadence];
  return next.length === 0 ? list : next.sort((a, b) => a - b);
}

/** web's StudioAgentFields.tsx: the brief, the gate's posture and the Window cadences it may read. */
function AgentFields({ form, setForm, asset }: { form: StudioDraft; setForm: SetDraft; asset: string }) {
  const { color } = useTheme();
  const full = form.persona.length >= AGENT_PERSONA_MAX_CHARS;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{A.persona}</Text>
        <Text style={[TYPE.data, { color: full ? color.accent : color.inkMuted }]}>{A.personaCount(form.persona.length, AGENT_PERSONA_MAX_CHARS)}</Text>
      </View>
      <TextInput
        value={form.persona}
        onChangeText={(text) => setForm((f) => ({ ...f, persona: text.slice(0, AGENT_PERSONA_MAX_CHARS) }))}
        placeholder={A.personaPlaceholder}
        placeholderTextColor={color.inkMuted}
        maxLength={AGENT_PERSONA_MAX_CHARS}
        multiline
        accessibilityLabel={A.persona}
        accessibilityHint={A.personaHint}
        style={[styles.area, { color: color.ink, borderColor: color.hairline, backgroundColor: color.surface1 }]}
      />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{A.personaHint}</Text>
      {form.persona !== A.defaultPersona ? (
        <Button label={A.restorePersona} variant="ghost" size="sm" block={false} onPress={() => setForm((f) => ({ ...f, persona: A.defaultPersona }))} />
      ) : null}

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{A.posture}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={A.posture} style={styles.choices}>
        {AGENT_POSTURES.map((p) => {
          const rules = POSTURES[p];
          return (
            <Choice
              key={p}
              title={RISK[p][0]}
              body={A.postureDetail(Math.round(rules.minConfidence * 100), rules.maxPriceCents, rules.breakerLosses)}
              on={form.posture === p}
              onPress={() => setForm((f) => ({ ...f, posture: p }))}
            />
          );
        })}
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{A.postureHint}</Text>

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{A.cadences}</Text>
      <View style={styles.toggles} accessibilityLabel={A.cadences}>
        {AGENT_CADENCES_SEC.map((c) => {
          const on = form.cadences.includes(c);
          return (
            <Pressable
              key={c}
              onPress={() => {
                haptic.select();
                setForm((f) => ({ ...f, cadences: toggleCadence(f.cadences, c) }));
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${formatCadence(c)} Windows`}
              style={[styles.toggle, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : color.surface1 }]}
            >
              <Text style={[TYPE.data, { color: on ? color.accent : color.ink }]}>{formatCadence(c)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{A.cadencesHint}</Text>

      <View style={[styles.plain, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{S.plain}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{describeSpec(draftSpec(form), asset)}</Text>
        {A.honesty.map((line) => (
          <Text key={line} style={[TYPE.caption, { color: color.inkMuted }]}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** web's StudioMirrorFields.tsx: whose calls, and how fresh one has to be. */
function MirrorFields({ form, setForm }: { form: StudioDraft; setForm: SetDraft }) {
  const { color } = useTheme();
  const words = S.mirror;
  const trader = form.trader.trim();
  const bad = trader.length > 0 && !BASE58.test(trader);
  return (
    <View style={styles.wrap}>
      <Field label={words.traderLabel} value={form.trader} placeholder={words.traderPlaceholder} error={bad ? words.traderInvalid : null} onChangeText={(t) => setForm((f) => ({ ...f, trader: t.trim() }))} />
      {bad ? null : <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.traderHelp}</Text>}
      {bad ? null : <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.traderScope}</Text>}
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.withinLabel}</Text>
      <Chips
        options={WITHIN_CHOICES.filter((sec) => sec >= MIRROR_WITHIN_MIN_SEC && sec <= MIRROR_WITHIN_MAX_SEC).map((sec) => ({ value: sec, label: sec < 60 ? `${sec}s` : `${sec / 60}m` }))}
        value={form.mirrorWithinSec}
        onPick={(sec) => setForm((f) => ({ ...f, mirrorWithinSec: sec }))}
      />
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.withinHelp}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.caveat}</Text>
    </View>
  );
}

/** Step 02 of web's StudioForm: the approach's own knobs, then the hard spending limits. */
export function StudioBehavior({ form, setForm, asset, symbol }: { form: StudioDraft; setForm: SetDraft; asset: string; symbol: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      {form.preset === "agent" ? (
        <AgentFields form={form} setForm={setForm} asset={asset} />
      ) : form.preset === "mirror" ? (
        <MirrorFields form={form} setForm={setForm} />
      ) : (
        <View style={styles.wrap}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Minimum move from the opening price</Text>
          <Chips options={["0.1", "0.2", "0.5", "1"].map((v) => ({ value: v, label: `${v}%` }))} value={form.thresholdPct} onPick={(v) => setForm((f) => ({ ...f, thresholdPct: v }))} />
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            A move above this threshold may produce an UP call; a move below its negative may produce DOWN. The strategy waits when the move is smaller. Each Window is considered once.
          </Text>
        </View>
      )}
      <View style={[styles.limits, { borderTopColor: color.hairline }]}>
        <Text style={[TYPE.title, { color: color.ink }]}>Hard spending limits</Text>
        <AmountInput label={S.perTrade} symbol={symbol} value={form.maxPerTrade} onChange={(v) => setForm((f) => ({ ...f, maxPerTrade: v }))} />
        <AmountInput label={S.daily} symbol={symbol} value={form.maxDaily} onChange={(v) => setForm((f) => ({ ...f, maxDaily: v }))} />
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          At most two open positions per follower. Followers can set tighter limits and revoke permission. Creating an agent does not fund it.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  area: { minHeight: 150, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, fontFamily: FONT.body, fontSize: 15, lineHeight: 21, textAlignVertical: "top" },
  choices: { gap: 8 },
  toggles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toggle: { minHeight: 44, minWidth: 56, paddingHorizontal: 14, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  plain: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 6 },
  limits: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 12 },
});
