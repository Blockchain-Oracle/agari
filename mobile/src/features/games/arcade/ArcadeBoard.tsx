import { shortHex } from "@agari/core/units";
import type { PostState } from "@/features/games/arcade/ArcadeOverlays";
import { ARCADE } from "@/features/games/arcade/copy";
import type { PostAbility } from "@/features/games/arcade/useArcadeScore";
import type { BoardWire } from "@/features/games/arcade/wire";
import { StyleSheet, Text, View } from "react-native";
import { useGamesTokens } from "~/features/games/frame";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { NOTE, NoteText } from "./ArcadeNotes";
import { useArcadeTokens } from "./palette";

/**
 * web's `ArcadeBoard.tsx` (`.ar-note.ar-board`): Pips's flat scoreboard — a place, a name, a score, your own row
 * in vermilion. Names are addresses, shortened, because the games' identity is the wallet. The head carries where
 * the last run landed; the foot carries the one line that never falls off: what a score here is.
 */
export function ArcadeBoard({ board, you, post, ability }: { board: BoardWire | null | undefined; you: string | null; post: PostState; ability: PostAbility }) {
  const { t, color } = useGamesTokens();
  const a = useArcadeTokens();
  const words = ARCADE.board;
  const banner = post.kind === "posted" ? (post.isBest ? ARCADE.over.newBest : ARCADE.over.ranked(post.rank)) : null;
  const rows = board?.rows ?? [];
  const empty = (text: string) => <Text style={[styles.empty, { color: color.inkSecondary }]}>{text}</Text>;
  const foot = (text: string) => <NoteText kind="foot">{text}</NoteText>;

  return (
    <View style={[NOTE.note, styles.board, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {words.title}
        </Text>
        {banner ? <Text style={[styles.banner, { color: color.accent }]}>{banner.toUpperCase()}</Text> : null}
      </View>

      {board === undefined
        ? empty(words.loading)
        : board === null
          ? empty(words.unreachable)
          : !board.configured
            ? empty(words.noStore)
            : rows.length === 0
              ? empty(words.empty)
              : (
                  <View style={styles.rows} accessibilityRole="list">
                    {rows.map((row, i) => {
                      const isYou = you !== null && row.wallet === you;
                      return (
                        <View
                          key={row.wallet}
                          style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: a.rowRule }]}
                          accessible
                          accessibilityLabel={`Place ${i + 1}, ${shortHex(row.wallet, 6, 4)}${isYou ? ", you" : ""}${row.calm ? ", calm" : ""}, score ${ARCADE.fmt(row.score)}`}
                        >
                          <Text style={[styles.mono, styles.place, { color: color.inkMuted }]}>{i + 1}</Text>
                          <View style={styles.who}>
                            <Text style={[styles.mono, { color: isYou ? color.accent : color.inkSecondary }]} numberOfLines={1}>
                              {shortHex(row.wallet, 6, 4)}
                            </Text>
                            {isYou ? <Tag label={words.you} /> : null}
                            {row.calm ? <Tag label={words.calm} /> : null}
                          </View>
                          <Text style={[styles.mono, { color: isYou ? color.accent : color.ink }]}>{ARCADE.fmt(row.score)}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

      {board?.me ? foot(words.yours(ARCADE.fmt(board.me.best), board.me.rank)) : null}
      {ability === "signedOut" ? foot(words.connect) : null}
      {ability === "unavailable" && board !== null ? foot(words.unavailable) : null}
      {foot(ARCADE.honesty)}
    </View>
  );
}

/** `.ar-board-tag`. */
function Tag({ label }: { label: string }) {
  const { color } = useGamesTokens();
  const a = useArcadeTokens();
  return (
    <View style={[styles.tag, { borderColor: a.tagBorder }]}>
      <Text style={[styles.tagText, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: 10 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  title: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  banner: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 22.4, letterSpacing: 1.96 },
  empty: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  rows: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  mono: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
  place: { width: 28 },
  who: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, overflow: "hidden" },
  tag: { paddingVertical: 1, paddingHorizontal: 6, borderRadius: 9999, borderWidth: 1 },
  tagText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.72 },
});
