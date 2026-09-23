import { PRICE_STALE_AFTER_MS } from "@agari/core/constants";
import { formatBaseUnits } from "@agari/core/units";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { PriceProbe, usePractice } from "~/games/usePractice";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** No-stake native game, scored on the live public feed after a short watch. */
export default function PracticeScreen() {
  const { color } = useTheme();
  const game = usePractice();
  const { round, active, score } = game;
  const price = active ? game.priceOf(active.asset) : null;
  const stale = price ? Date.now() - price.publishTimeSec * 1000 > PRICE_STALE_AFTER_MS : false;
  const play = (side: "up" | "down") => { if (!active || !price || stale) return; void Haptics.selectionAsync(); game.pick(active, side); };
  return <>
    <Stack.Screen options={{ title: "Practice", headerTitle: "Practice", unstable_headerLeftItems: undefined, unstable_headerRightItems: undefined }} />
    {game.assets.map((asset) => <PriceProbe key={asset} asset={asset} onPrice={game.reportPrice} />)}
    <ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
      <Text style={[styles.kicker, { color: color.accent }]}>MARKET-POWERED GAME · NO STAKES</Text>
      <Text style={[styles.title, { color: color.ink }]}>Practice the call.</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>Choose a side on each real Window. After your last pick, we watch the public price feed for 30 seconds. This is a practice score, not the Window's settlement or a payout.</Text>
      {game.readiness !== "ready" ? <Panel title={game.readiness === "loading" ? "Dealing from the venue…" : game.readiness === "offline" ? "Market feed unavailable" : "Between playable Windows"} line={game.readiness === "between" ? "A new deck appears when live Windows have enough time left for the round." : "The deck needs live Windows and their public prices."} /> : score ? <>
        <View style={[styles.score, { backgroundColor: color.cream, borderColor: color.creamHairline }]}><Text style={[styles.kicker, { color: color.accent }]}>ROUND COMPLETE</Text><Text style={[styles.scoreNumber, { color: color.creamInk }]}>{score.youWon} : {score.botWon}</Text><Text style={[TYPE.body, { color: color.creamInk }]}>{score.winner === "you" ? "You won this round." : score.winner === "bot" ? "The coin-flip opponent won." : "It's a tie."}</Text></View>
        {score.cards.map((card) => <View key={card.card.index} style={[styles.resultRow, { borderColor: color.hairline, backgroundColor: color.surface1 }]}><AssetDisc asset={card.card.asset} size={30} /><View style={{ flex: 1 }}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{card.card.asset} · {card.side.toUpperCase()}</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{card.move === "flat" ? "Price stayed flat" : `Price moved ${card.move}`}</Text></View><Text style={[TYPE.bodyStrong, { color: card.you === "won" ? color.profit : color.loss }]}>{card.you.toUpperCase()}</Text></View>)}
        {score.cards.length < round.picks.length ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>Some cards could not be scored because a closing feed reading was unavailable.</Text> : null}
        <Action label="Play a new deck" onPress={game.deal} />
      </> : round.phase === "watching" ? <View style={[styles.score, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[styles.kicker, { color: color.accent }]}>WATCHING THE LIVE FEED</Text><Text style={[styles.scoreNumber, { color: color.ink }]}>{game.leftSec}s</Text><Text style={[TYPE.body, { color: color.inkSecondary }]}>All calls close on one public feed reading when the watch ends.</Text></View> : active ? <>
        <View style={styles.progress}><Text style={[styles.kicker, { color: color.inkMuted }]}>CARD {active.index + 1} OF {round.cards.length}</Text><Text style={[styles.kicker, { color: color.inkMuted }]}>UP / DOWN</Text></View>
        <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}><View style={styles.asset}><AssetDisc asset={active.asset} size={48} /><View><Text style={[TYPE.title, { color: color.ink }]}>{active.asset}</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{active.intervalSec / 60}m live Window</Text></View></View><Text style={[styles.question, { color: color.ink }]}>Where will the price go?</Text><View style={[styles.priceBox, { backgroundColor: color.surface2 }]}><Text style={[styles.kicker, { color: color.inkMuted }]}>{stale ? "LAST PUBLIC PRICE · AGED" : "LIVE PUBLIC PRICE"}</Text><Text style={[TYPE.dataLg, { color: color.ink }]}>{price ? formatBaseUnits(price.priceRaw, price.decimals, { maxDp: 2, minDp: 2 }) : "Waiting for price…"}</Text></View></View>
        <View style={styles.sides}><Pressable disabled={!price || stale} onPress={() => play("up")} accessibilityRole="button" style={[styles.side, { backgroundColor: color.profit, opacity: price && !stale ? 1 : 0.4 }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>↑  Up</Text></Pressable><Pressable disabled={!price || stale} onPress={() => play("down")} accessibilityRole="button" style={[styles.side, { backgroundColor: color.loss, opacity: price && !stale ? 1 : 0.4 }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>↓  Down</Text></Pressable></View>
        {stale ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>Waiting for a fresh public price before you call.</Text> : null}
      </> : null}
      {round.picks.length > 0 && round.phase !== "scored" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{round.picks.length} of {round.cards.length} calls recorded. A coin-flip opponent is scored against you.</Text> : null}
    </ScrollView>
  </>;
}

function Panel({ title, line }: { title: string; line: string }) { const { color } = useTheme(); return <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.title, { color: color.ink }]}>{title}</Text><Text style={[TYPE.body, { color: color.inkSecondary }]}>{line}</Text></View>; }
function Action({ label, onPress }: { label: string; onPress: () => void }) { const { color } = useTheme(); return <Pressable onPress={onPress} accessibilityRole="button" style={[styles.action, { backgroundColor: color.accent }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>{label}</Text><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>→</Text></Pressable>; }

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 28, paddingBottom: 110, gap: 18 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.5 }, title: { fontFamily: "Georgia", fontWeight: "700", fontSize: 39, lineHeight: 43, letterSpacing: -2 },
  progress: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 }, card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 20 }, asset: { flexDirection: "row", alignItems: "center", gap: 13 }, question: { fontFamily: "Georgia", fontWeight: "700", fontSize: 32, lineHeight: 36 },
  priceBox: { borderRadius: RADIUS.md, padding: 16, gap: 7 }, sides: { flexDirection: "row", gap: 10 }, side: { flex: 1, height: 54, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  score: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 24, gap: 10, marginTop: 18 }, scoreNumber: { fontFamily: FONT.dataStrong, fontSize: 52, lineHeight: 58 }, resultRow: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  action: { height: 52, paddingHorizontal: 17, borderRadius: RADIUS.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
