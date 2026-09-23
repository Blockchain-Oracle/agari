import { DESK_PRESETS, nameOf } from "@agari/core/desk";
import { BASKETS } from "@agari/core/market";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { draftFromPreset, type StudioDraft } from "@/features/desk/draft";
import { pctSigned } from "@/features/desk/format";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { basketLine, lineNumbers, useDeskMarks } from "@/features/desk/useDeskMarks";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TYPE, useTheme } from "~/theme";
import { LogoStack, RadioCards, Sparkline, type RadioCardItem } from "../kit";

const B = STUDIO.basket;
const OWN = "own";

/** The move across a line in basis points, integer arithmetic; null with fewer than two points. */
function moveBps(line: readonly bigint[]): number | null {
  const first = line[0];
  const last = line.at(-1);
  if (first === undefined || last === undefined || line.length < 2 || first === 0n) return null;
  return Number(((last - first) * 10_000n) / first);
}

/** Keep the limits and notes when the basket changes; only the weights come from the preset. */
export const keepLimits = (d: StudioDraft, next: StudioDraft): StudioDraft => ({
  ...next,
  notes: d.notes,
  practiceCash: d.practiceCash,
  driftPct: d.driftPct,
  positionPct: d.positionPct,
  lossPct: d.lossPct,
  premiumPct: d.premiumPct,
  perAction: d.perAction,
  daily: d.daily,
  large: d.large,
  liveMode: d.liveMode,
});

/**
 * The five baskets as cards (web's studio/BasketChoice.tsx): the cluster mark, the ticker, every member's logo, and
 * the basket's last seven days from the hourly marks. A sixth card starts your own mix.
 */
export function BasketChoice({ draft, setDraft }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void }) {
  const { color } = useTheme();
  const marks = useDeskMarks();
  const items: RadioCardItem<string>[] = DESK_PRESETS.map((p) => {
    const members = BASKETS[p.basket].members.map((m) => m.symbol);
    const line = basketLine(marks, p.basket);
    const move = moveBps(line);
    const moveInk = move === null ? color.inkMuted : move > 0 ? color.profit : move < 0 ? color.loss : color.inkSecondary;
    return {
      value: p.id,
      media: (
        <>
          <AssetDisc asset={p.basket} size={34} />
          <Text style={[TYPE.data, { color: color.accent }]}>${p.basket}</Text>
        </>
      ),
      title: p.name,
      body: (
        <View style={styles.members}>
          <LogoStack symbols={members} names={members.map(nameOf)} size={18} max={4} />
          <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]} numberOfLines={1}>
            {members.length <= 3 ? members.map(nameOf).join(" · ") : B.members(members.length)}
          </Text>
        </View>
      ),
      footer: (
        <>
          {line.length >= 2 ? <Sparkline values={lineNumbers(line)} width={92} height={26} /> : <Text style={[TYPE.caption, { color: color.inkMuted }]}>{B.noLine}</Text>}
          <Text style={[TYPE.data, { color: moveInk }]}>{move === null ? "—" : pctSigned(move)}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{B.week}</Text>
        </>
      ),
    };
  });
  items.push({
    value: OWN,
    media: <SymbolView name={{ ios: "square.grid.2x2", android: "widgets" }} size={26} tintColor={color.accent} />,
    title: B.own.title,
    body: B.own.body,
  });
  const pick = (value: string) => setDraft((d) => (value === OWN ? { ...d, preset: null } : keepLimits(d, draftFromPreset(value))));
  return <RadioCards value={draft.preset ?? OWN} onChange={pick} items={items} label={B.presetsAria} />;
}

const styles = StyleSheet.create({
  members: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 },
});
