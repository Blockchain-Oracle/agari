import { MANDATE_NOTES_MAX_CHARS, thresholdBps, type DeskMandate } from "@agari/core/desk";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import type { StudioDraft } from "@/features/desk/draft";
import { pct } from "@/features/desk/format";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { numberOf, STRICTNESS, strictnessOf, type Strictness } from "@/features/desk/studio/studio-model";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { IconTile, RadioCards, Slider, type RadioCardItem } from "../kit";

const L = DESK.studio.limits;
const S = STUDIO.strictness;

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

/** web's LimitsForm.tsx ranges, verbatim. */
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
const ICONS: Record<Strictness, { ios: string; android: string }> = {
  careful: { ios: "checkmark.shield", android: "verified_user" },
  balanced: { ios: "gauge.with.dots.needle.50percent", android: "speed" },
  loose: { ios: "wind", android: "air" },
};

const shown = (spec: Spec, text: string): string => (spec.unit === "$" ? `$${text}` : `${text}%`);

function LimitRow({ spec, draft, setDraft }: { spec: Spec; draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void }) {
  const { color } = useTheme();
  const text = draft[spec.key];
  const value = Math.min(spec.max, Math.max(spec.min, numberOf(text, spec.min)));
  const program = spec.by === "program";
  return (
    <View style={[styles.limit, { borderColor: color.hairline }]}>
      <View style={styles.limitHead}>
        <Text style={[TYPE.body, styles.grow, { color: color.ink }]}>{spec.sentence(shown(spec, text))}</Text>
        <Text style={[styles.by, { color: program ? color.accent : color.inkSecondary, backgroundColor: program ? color.accentWash : color.surface2 }]}>{program ? S.program : S.code}</Text>
      </View>
      <Slider value={value} onChange={(v) => setDraft((d) => ({ ...d, [spec.key]: String(v) }))} min={spec.min} max={spec.max} step={spec.step} label={spec.sentence(shown(spec, text))} display={shown(spec, text)} />
    </View>
  );
}

/**
 * Step 02 (web's LimitsForm.tsx): how strict as one of three cards, then every limit on its slider, each its own
 * sentence with who enforces it (the program on-chain, or the desk's own code), and a notes box in your own words.
 */
export function LimitsStep({ draft, setDraft, mandate }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void; mandate: DeskMandate | null }) {
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
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{S.title}</Text>
        {level === null ? <Text style={[TYPE.caption, { color: color.accent }]}>{S.custom}</Text> : null}
      </View>
      <RadioCards value={level} onChange={(k) => setDraft((d) => ({ ...d, ...STRICTNESS[k] }))} items={items} label={S.aria} />

      <Text style={[TYPE.labelMicro, styles.section, { color: color.inkMuted }]}>{S.moneyTitle}</Text>
      {MONEY.map((spec) => (
        <LimitRow key={spec.key} spec={spec} draft={draft} setDraft={setDraft} />
      ))}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{L.programNote}</Text>

      <Text style={[TYPE.labelMicro, styles.section, { color: color.inkMuted }]}>{S.shapeTitle}</Text>
      {SHAPE.map((spec) => (
        <LimitRow key={spec.key} spec={spec} draft={draft} setDraft={setDraft} />
      ))}
      {floor !== null && floor > (mandate?.driftToleranceBps ?? 0) ? <Text style={[TYPE.caption, { color: color.warning }]}>{L.driftFloor(pct(floor))}</Text> : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{L.codeNote}</Text>

      <Text style={[TYPE.labelMicro, styles.section, { color: color.inkMuted }]}>{L.notes}</Text>
      <TextInput
        value={draft.notes}
        onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
        maxLength={MANDATE_NOTES_MAX_CHARS}
        multiline
        placeholder="never buy on a Sunday"
        placeholderTextColor={color.inkMuted}
        accessibilityLabel={L.notes}
        style={[styles.notes, { color: color.ink, backgroundColor: color.surface1, borderColor: color.hairline }]}
      />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {L.notesHint} {L.count(draft.notes.length, MANDATE_NOTES_MAX_CHARS)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  grow: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { marginTop: 12 },
  limit: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 2 },
  limitHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  by: { fontFamily: FONT.data, fontSize: 10.5, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  notes: { minHeight: 96, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, fontFamily: FONT.body, fontSize: 15, textAlignVertical: "top" },
});
