import { practiceMove, type DeckCard, type Pick, type PracticeCardResult, type PracticeMove } from "@agari/core/games";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { cadenceLabel } from "~/features/games/stage";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** The move as a signed percentage, computed in integers and only made a float to be printed (web's `movePercent`). */
export function movePercent(entryRaw: bigint, closeRaw: bigint): string {
  if (entryRaw === 0n) return "—";
  const thousandthsOfPercent = ((closeRaw - entryRaw) * 100_000n) / entryRaw;
  const value = Number(thousandthsOfPercent) / 1_000;
  return `${value > 0 ? "+" : ""}${value.toFixed(3)}%`;
}

interface PracticeRowProps {
  card: DeckCard;
  side: Pick;
  entryRaw: bigint;
  /** The live reading while watching, or the close once scored. Null when unreadable. */
  closeRaw: bigint | null;
  botSide?: Pick;
  you?: PracticeCardResult;
  bot?: PracticeCardResult;
}

/**
 * web's `PracticeRow`: one card in the watch and again in the result. The watch has no verdicts (a card
 * "winning" eight seconds into the watch has won nothing); verdicts arrive with the close.
 */
export function PracticeRow({ card, side, entryRaw, closeRaw, botSide, you, bot }: PracticeRowProps) {
  const { color } = useTheme();
  const move = closeRaw === null ? null : practiceMove(entryRaw, closeRaw);
  const moveInk = moveColor(move, color);
  return (
    <View style={[styles.row, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <View style={styles.top}>
        <AssetDisc asset={card.asset} size={28} />
        <View style={styles.name}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{card.asset}</Text>
          <Text style={[styles.meta, { color: color.inkMuted }]}>{cadenceLabel(card.intervalSec)}</Text>
        </View>
        <View
          style={styles.moveBox}
          accessible
          accessibilityLabel={move && closeRaw !== null ? `${PRACTICE.result.move[move]} ${movePercent(entryRaw, closeRaw)}` : "Price unreadable"}
        >
          {move === "up" || move === "down" ? (
            <SymbolView name={move === "up" ? { ios: "arrow.up", android: "arrow_upward" } : { ios: "arrow.down", android: "arrow_downward" }} size={12} tintColor={moveInk} />
          ) : null}
          <Text style={[styles.move, { color: moveInk }]}>{closeRaw === null ? "—" : movePercent(entryRaw, closeRaw)}</Text>
        </View>
      </View>
      <View style={styles.sides}>
        <Side label={PRACTICE.result.you} side={side} verdict={you} />
        {botSide ? <Side label={PRACTICE.result.bot} side={botSide} verdict={bot} /> : null}
      </View>
    </View>
  );
}

function Side({ label, side, verdict }: { label: string; side: Pick; verdict?: PracticeCardResult }) {
  const { color } = useTheme();
  const verdictInk = verdict === "won" ? color.profit : verdict === "lost" ? color.loss : color.inkMuted;
  return (
    <View style={styles.side}>
      <View style={[styles.dot, { backgroundColor: side === "up" ? color.profit : color.loss }]} />
      <Text style={[styles.sideText, { color: color.inkSecondary }]} numberOfLines={1}>
        {label} · {PRACTICE.result.call[side]}
      </Text>
      {verdict ? (
        <View style={[styles.verdict, { borderColor: verdictInk }]}>
          <Text style={[styles.verdictText, { color: verdictInk }]}>{PRACTICE.result.cardResult[verdict].toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );
}

function moveColor(move: PracticeMove | null, color: ReturnType<typeof useTheme>["color"]): string {
  if (move === "up") return color.profit;
  if (move === "down") return color.loss;
  return color.inkMuted;
}

const styles = StyleSheet.create({
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1 },
  meta: { fontFamily: FONT.data, fontSize: 11 },
  moveBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  move: { fontFamily: FONT.dataStrong, fontSize: 15, fontVariant: ["tabular-nums"] },
  sides: { gap: 6 },
  side: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sideText: { flex: 1, fontFamily: FONT.body, fontSize: 13 },
  verdict: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 1 },
  verdictText: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 0.8 },
});
