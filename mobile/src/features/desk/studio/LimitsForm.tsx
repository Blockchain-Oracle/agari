import { MANDATE_NOTES_MAX_CHARS, thresholdBps, type DeskMandate } from "@agari/core/desk";
import { Gauge, ShieldCheck, Wind, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import type { StudioDraft } from "@/features/desk/draft";
import { pct } from "@/features/desk/format";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { numberOf, STRICTNESS, strictnessOf, type Strictness } from "@/features/desk/studio/studio-model";
import { FONT, useTheme } from "~/theme";
import { Slider } from "../kit";
import { IconTile, StBy, StHint, StLabel } from "./kit-bits";
import { RadioCards, type RadioCardItem } from "./kit-radio";

const L = DESK.studio.limits;
const S = STUDIO.strictness;
type SetDraft = (update: (d: StudioDraft) => StudioDraft) => void;

type Key = "driftPct" | "positionPct" | "lossPct" | "premiumPct" | "perAction" | "daily" | "large";
interface Spec {
  key: Key;
  sentence: (v: string) => string;
  by: "program" | "code";
  unit: "%" | "$";
  min: number;
  max: number;
  step: number;
}

const MONEY: readonly Spec[] = [
  { key: "perAction", sentence: L.perAction, by: "program", unit: "$", min: 5, max: 1_000, step: 5 },
  { key: "daily", sentence: L.daily, by: "program", unit: "$", min: 5, max: 5_000, step: 5 },
  { key: "premiumPct", sentence: L.premium, by: "program", unit: "%", min: 1, max: 50, step: 1 },
  { key: "large", sentence: L.large, by: "code", unit: "$", min: 5, max: 2_000, step: 5 },
];
const SHAPE: readonly Spec[] = [
  { key: "driftPct", sentence: L.drift, by: "code", unit: "%", min: 1, max: 20, step: 0.5 },
  { key: "positionPct", sentence: L.position, by: "code", unit: "%", min: 10, max: 100, step: 5 },
  { key: "lossPct", sentence: L.loss, by: "code", unit: "%", min: 5, max: 50, step: 1 },
];

const ICONS: Record<Strictness, LucideIcon> = { careful: ShieldCheck, balanced: Gauge, loose: Wind };
const shown = (spec: Spec, text: string): string => (spec.unit === "$" ? `$${text}` : `${text}%`);

/** One `.st-limit`: the limit as its own sentence, who enforces it, and its slider. */
function LimitRow({ spec, draft, setDraft, first }: { spec: Spec; draft: StudioDraft; setDraft: SetDraft; first: boolean }) {
  const { color } = useTheme();
  const text = draft[spec.key];
  const value = Math.min(spec.max, Math.max(spec.min, numberOf(text, spec.min)));
  return (
    <View style={[styles.limit, !first && { borderTopWidth: 1, borderTopColor: color.hairline }]}>
      <View style={styles.limitHead}>
        <Text style={[styles.sentence, { color: color.ink }]}>{spec.sentence(shown(spec, text))}</Text>
        <StBy by={spec.by} text={spec.by === "program" ? S.program : S.code} />
      </View>
      <Slider value={value} onChange={(v) => setDraft((d) => ({ ...d, [spec.key]: String(v) }))} min={spec.min} max={spec.max} step={spec.step} label={spec.sentence(shown(spec, text))} display={shown(spec, text)} />
    </View>
  );
}

function Limits({ specs, draft, setDraft }: { specs: readonly Spec[]; draft: StudioDraft; setDraft: SetDraft }) {
  const { color } = useTheme();
  return (
    <View style={[styles.limits, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      {specs.map((spec, i) => (
        <LimitRow key={spec.key} spec={spec} draft={draft} setDraft={setDraft} first={i === 0} />
      ))}
    </View>
  );
}

/**
 * Step 02 (web's LimitsForm.tsx): pick how strict as one of three cards, then fine-tune every limit on its slider.
 * Each limit is its own sentence with who enforces it: the program on-chain or the desk's own code. A notes box for
 * your own words.
 */
export function LimitsForm({ draft, setDraft, mandate }: { draft: StudioDraft; setDraft: SetDraft; mandate: DeskMandate | null }) {
  const { color } = useTheme();
  const floor = mandate ? thresholdBps(mandate) : null;
  const level = strictnessOf(draft);
  const items: RadioCardItem<Strictness>[] = (Object.keys(STRICTNESS) as Strictness[]).map((k) => ({
    value: k,
    media: <IconTile icon={ICONS[k]} level={k} />,
    title: S.presets[k].title,
    body: S.presets[k].line,
  }));
  return (
    <View style={styles.form}>
      <View style={styles.block} accessibilityLabel={S.aria}>
        <View style={styles.blockHead}>
          <StLabel>{S.title}</StLabel>
          {level === null ? <StHint>{S.custom}</StHint> : null}
        </View>
        <RadioCards value={level} onChange={(k) => setDraft((d) => ({ ...d, ...STRICTNESS[k] }))} items={items} label={S.aria} />
      </View>

      <View style={styles.block}>
        <StLabel>{S.moneyTitle}</StLabel>
        <Limits specs={MONEY} draft={draft} setDraft={setDraft} />
        <StHint>{L.programNote}</StHint>
      </View>

      <View style={styles.block}>
        <StLabel>{S.shapeTitle}</StLabel>
        <Limits specs={SHAPE} draft={draft} setDraft={setDraft} />
        {floor !== null && floor > (mandate?.driftToleranceBps ?? 0) ? <StHint>{L.driftFloor(pct(floor))}</StHint> : null}
        <StHint>{L.codeNote}</StHint>
      </View>

      <View style={styles.block}>
        <StLabel>{L.notes}</StLabel>
        <TextInput
          value={draft.notes}
          maxLength={MANDATE_NOTES_MAX_CHARS}
          onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
          placeholder="never buy on a Sunday"
          placeholderTextColor={color.inkMuted}
          multiline
          textAlignVertical="top"
          accessibilityLabel={L.notes}
          style={[styles.notes, { borderColor: color.hairline, backgroundColor: color.ground, color: color.ink }]}
        />
        <StHint>
          {L.notesHint} {L.count(draft.notes.length, MANDATE_NOTES_MAX_CHARS)}
        </StHint>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 32 },
  block: { gap: 12 },
  blockHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  limits: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  limit: { gap: 10, paddingVertical: 14, paddingHorizontal: 18 },
  limitHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sentence: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 22.4 },
  notes: { minHeight: 88, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, fontFamily: FONT.body, fontSize: 14, lineHeight: 21 },
});
