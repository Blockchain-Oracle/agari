import { DESK_PRESETS, nameOf } from "@agari/core/desk";
import { BASKETS } from "@agari/core/market";
import { Blocks } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { draftFromPreset, type StudioDraft } from "@/features/desk/draft";
import { pctSigned } from "@/features/desk/format";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { basketLine, lineNumbers, useDeskMarks, type DeskMarks } from "@/features/desk/useDeskMarks";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { LogoStack, Sparkline } from "../kit";
import { StLabel } from "./kit-bits";
import { radioBody, RadioCards, type RadioCardItem } from "./kit-radio";
import { WeightEditor } from "./WeightEditor";

const B = STUDIO.basket;
const OWN = "own";
type SetDraft = (update: (d: StudioDraft) => StudioDraft) => void;

/** The move across a line in basis points, integer arithmetic; null with fewer than two points. */
function moveBps(line: readonly bigint[]): number | null {
  const first = line[0];
  const last = line.at(-1);
  if (first === undefined || last === undefined || line.length < 2 || first === 0n) return null;
  return Number(((last - first) * 10_000n) / first);
}

/** A preset's basket with everything but its weights, cash and name: the limits the draft already carries. */
export const keepLimits = (d: StudioDraft, next: StudioDraft): StudioDraft => ({ ...next, notes: d.notes, practiceCash: d.practiceCash, driftPct: d.driftPct, positionPct: d.positionPct, lossPct: d.lossPct, premiumPct: d.premiumPct, perAction: d.perAction, daily: d.daily, large: d.large, liveMode: d.liveMode });

/**
 * web's studio/BasketChoice.tsx: the five baskets as cards (the cluster mark, the ticker, every member's logo and
 * name, the last seven days from the hourly marks), and a sixth card that starts your own mix.
 */
function BasketChoice({ draft, setDraft, marks }: { draft: StudioDraft; setDraft: SetDraft; marks: DeskMarks | null }) {
  const { color } = useTheme();
  const items: RadioCardItem<string>[] = DESK_PRESETS.map((p) => {
    const members = BASKETS[p.basket].members.map((m) => m.symbol);
    const line = basketLine(marks, p.basket);
    const move = moveBps(line);
    return {
      value: p.id,
      media: (
        <>
          <AssetDisc asset={p.basket} size={44} />
          <Text style={[styles.ticker, { color: color.accent }]}>${p.basket}</Text>
        </>
      ),
      title: p.name,
      body: (
        <View style={styles.members}>
          <LogoStack symbols={members} names={members.map(nameOf)} size={20} max={4} />
          <Text style={[radioBody, { color: color.inkSecondary }]}>{members.length <= 3 ? members.map(nameOf).join(" · ") : B.members(members.length)}</Text>
        </View>
      ),
      footer: (
        <>
          {line.length >= 2 ? <Sparkline values={lineNumbers(line)} width={92} height={26} /> : <Text style={[styles.noLine, { color: color.inkMuted }]}>{B.noLine}</Text>}
          <Text style={[styles.move, { color: move === null || move === 0 ? color.inkSecondary : move > 0 ? color.profit : color.loss }]}>{move === null ? "—" : pctSigned(move)}</Text>
          <Text style={[styles.week, { color: color.inkMuted }]}>{B.week}</Text>
        </>
      ),
    };
  });
  items.push({
    value: OWN,
    media: (
      <View style={[styles.own, { borderColor: color.inkMuted }]}>
        <Blocks size={20} color={color.inkSecondary} />
      </View>
    ),
    title: B.own.title,
    body: B.own.body,
  });

  const pick = (value: string) => setDraft((d) => (value === OWN ? { ...d, preset: null } : keepLimits(d, draftFromPreset(value))));
  return <RadioCards value={draft.preset ?? OWN} onChange={pick} items={items} label={B.presetsAria} />;
}

/**
 * Step 01, the basket (web's BasketPicker.tsx): the basket cards under their label, then the weights. Picking a basket
 * fills the weights; editing a weight keeps the basket's name only while the mix still matches it.
 */
export function BasketPicker({ draft, setDraft }: { draft: StudioDraft; setDraft: SetDraft }) {
  const marks = useDeskMarks();
  return (
    <View style={styles.picker}>
      <View style={styles.block} accessibilityLabel={DESK.studio.basket.presets}>
        <StLabel>{DESK.studio.basket.presets}</StLabel>
        <BasketChoice draft={draft} setDraft={setDraft} marks={marks} />
      </View>
      <WeightEditor draft={draft} setDraft={setDraft} />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: 32 },
  block: { gap: 12 },
  ticker: { fontFamily: FONT.dataStrong, fontSize: 11.5, lineHeight: 18.4, letterSpacing: 0.46 },
  members: { flexDirection: "row", alignItems: "center", gap: 8 },
  noLine: { fontFamily: FONT.body, fontSize: 11.5, lineHeight: 18.4 },
  move: { marginLeft: "auto", fontFamily: FONT.dataStrong, fontSize: 12.5, lineHeight: 20, fontVariant: ["tabular-nums"] },
  week: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8 },
  own: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});
