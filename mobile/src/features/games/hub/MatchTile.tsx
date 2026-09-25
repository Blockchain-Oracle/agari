import type { MatchState } from "@agari/core/games";
import { shortHex } from "@agari/core/units";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Plate, PlateBody, PlateTitle, PulseDot, ResumeCta, useGamesTokens } from "~/features/games/frame";
import { useGames } from "~/features/games/shell";
import { FONT } from "~/theme";

/**
 * web's `MatchTile` (Flicky's "your match", `.gm-resume.gm-match-tile`): the opponent, how many cards have
 * settled, whether it is live, and one way in — over the shell's copy of the match the duel stage publishes.
 */
export function MatchTile({ match }: { match: MatchState }) {
  const { t, color } = useGamesTokens();
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
    <Plate resume style={styles.tile}>
      <View style={styles.head}>
        <PlateTitle>{words.title}</PlateTitle>
        <View style={[styles.badge, { backgroundColor: live ? t.matchBadgeLiveBg : t.matchBadgeBg }]}>
          {live ? <PulseDot color={color.profit} /> : null}
          <Text style={[styles.badgeText, { color: live ? color.profit : color.inkSecondary }]}>{(live ? words.live : words.done).toUpperCase()}</Text>
        </View>
      </View>
      <PlateBody>{words.body}</PlateBody>
      <View style={styles.foot}>
        <Fact k={words.versus} v={opponent ? shortHex(opponent, 6, 4) : "—"} />
        {cards > 0 ? <Fact k={words.settled} v={`${settled} / ${cards}`} /> : null}
        <Pressable
          onPress={() => {
            feedback("tap");
            router.push(`/games/duel/${match.matchId}` as Href);
          }}
          accessibilityRole="link"
          hitSlop={8}
        >
          <ResumeCta>{live ? words.cta : words.result}</ResumeCta>
        </Pressable>
      </View>
    </Plate>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  const { color } = useGamesTokens();
  return (
    <View style={styles.fact}>
      <Text style={[styles.k, { color: color.inkMuted }]}>{k.toUpperCase()}</Text>
      <Text style={[styles.v, { color: color.ink }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 10, marginBottom: 32 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  badgeText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.8 },
  foot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  fact: { gap: 2 },
  k: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26 },
  v: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
});
