import { practiceMove, type DeckCard, type Pick, type PracticeCardResult, type PracticeMove } from "@agari/core/games";
import { StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { useGamesTokens } from "~/features/games/frame";
import { cadenceLabel } from "~/features/games/stage";
import { FONT } from "~/theme";

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
 * web's `PracticeRow` (`.pr-row`): the asset and cadence, the move with its arrow (the arrow, not the colour, says
 * which way), and each side's call. The watch has no verdicts; they arrive with the close.
 */
export function PracticeRow({ card, side, entryRaw, closeRaw, botSide, you, bot }: PracticeRowProps) {
  const { t, color } = useGamesTokens();
  const move = closeRaw === null ? null : practiceMove(entryRaw, closeRaw);
  const ink = moveInk(move, color);
  return (
    <View style={[styles.row, { borderColor: t.cardBorder, backgroundColor: t.cardBg }]}>
      <View style={styles.top}>
        <View style={styles.name}>
          <Text style={[styles.asset, { color: color.ink }]}>{card.asset}</Text>
          <Text style={[styles.meta, { color: color.inkMuted }]}>{cadenceLabel(card.intervalSec)}</Text>
        </View>
        <View style={styles.move} accessible accessibilityLabel={move && closeRaw !== null ? `${PRACTICE.result.move[move]} ${movePercent(entryRaw, closeRaw)}` : "Price unreadable"}>
          {move ? <Text style={[styles.arrow, { color: ink }]}>{PRACTICE.result.arrow[move]}</Text> : null}
          <Text style={[styles.moveText, { color: ink }]}>{closeRaw === null ? "—" : movePercent(entryRaw, closeRaw)}</Text>
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
  const { color } = useGamesTokens();
  const verdictInk = verdict === "won" ? color.profit : verdict === "lost" ? color.loss : color.inkMuted;
  return (
    <View style={styles.side}>
      <View style={[styles.dot, { backgroundColor: side === "up" ? color.profit : color.loss }]} />
      <Text style={[styles.sideText, { color: color.inkMuted }]}>
        {label} · {PRACTICE.result.call[side]}
      </Text>
      {verdict ? <Text style={[styles.sideText, styles.verdict, { color: verdictInk }]}>{PRACTICE.result.cardResult[verdict].toUpperCase()}</Text> : null}
    </View>
  );
}

export function moveInk(move: PracticeMove | null, color: ReturnType<typeof useGamesTokens>["color"]): string {
  if (move === "up") return color.profit;
  if (move === "down") return color.loss;
  return color.inkMuted;
}

const styles = StyleSheet.create({
  row: { gap: 4, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  asset: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  move: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  arrow: { fontFamily: FONT.dataRegular, fontSize: 12 },
  moveText: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, fontVariant: ["tabular-nums"] },
  sides: { flexDirection: "row", flexWrap: "wrap", rowGap: 6, columnGap: 14 },
  side: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 9999 },
  sideText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  verdict: { letterSpacing: 0.6 },
});
