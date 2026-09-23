import type { MatchState } from "@agari/core/games";
import { shortHex } from "@agari/core/units";
import { router, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Pill } from "~/components/kit";
import { useGames } from "~/features/games/shell";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's `MatchTile` (Flicky's "your match"): the opponent, how many cards have settled, whether it is live,
 * and one button in, over the shell's copy of the match that the duel stage publishes from arena events.
 */
export function MatchTile({ match }: { match: MatchState }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const { feedback } = useGames();
  if (!("matchId" in match)) return null;
  const you = address ?? null;
  const opponent = you === null ? null : match.players.creator === you ? match.players.challenger : match.players.creator;
  const cards = "cards" in match ? match.cards.length : 0;
  const settled = "receipts" in match ? match.receipts.filter((r) => r.player === you && r.payoutBase !== null).length : 0;
  const live = match.phase !== "finalized" && match.phase !== "refunded";
  const words = GAMES.resume;

  return (
    <View style={[styles.plate, { backgroundColor: color.accentWash, borderColor: color.accentDim }]} accessibilityLabel={words.title}>
      <View style={styles.head}>
        <Text style={[TYPE.title, styles.title, { color: color.ink }]}>{words.title}</Text>
        <Pill label={live ? words.live : words.done} tone={live ? "profit" : "neutral"} dot={live} />
      </View>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.body}</Text>
      <View style={styles.facts}>
        <Fact k={words.versus} v={opponent ? shortHex(opponent, 6, 4) : "—"} />
        {cards > 0 ? <Fact k={words.settled} v={`${settled} / ${cards}`} /> : null}
      </View>
      <Button
        label={live ? words.cta : words.result}
        onPress={() => {
          feedback("tap");
          router.push(`/games/duel/${match.matchId}` as Href);
        }}
      />
    </View>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{k}</Text>
      <Text style={[TYPE.data, { color: color.ink }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1 },
  facts: { flexDirection: "row", gap: 24 },
  fact: { gap: 4 },
});
