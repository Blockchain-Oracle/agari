import { cardsInMask } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { Hash32 } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { useArenaMatch } from "@agari/markets/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import type { DuelCard } from "@/features/games/duel/duel-card";
import { useVenue } from "@/features/markets/useVenue";
import { Button, LoadingState } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { DuelResultModal } from "./DuelResultModal";
import { Body, Foot, Key, Plate, Refusal, Seat } from "./parts";

/**
 * web's `DuelPublicResult.tsx`: `/games/duel/[matchId]` for anyone not seated in it — both seats, the verdict,
 * every card's two picks and the share, read straight off the arena with no wallet and no room.
 */
export function DuelPublicResult({ matchId }: { matchId: Hash32 }) {
  const { color } = useTheme();
  const reading = useArenaMatch(matchId);
  const { boot } = useVenue();
  const [modalOpen, setModalOpen] = useState(false);
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const words = DUEL.public;

  if (reading === null) return <LoadingState shape="plate" label={words.reading} />;
  if (!isOk(reading)) return <Refusal>{words.unreadable}</Refusal>;
  const view = reading.value;
  if (!view) return <Refusal>{words.unknown}</Refusal>;

  const { match } = view;
  const money = (base: bigint | null) => (base === null || decimals === null ? "—" : formatBaseUnits(base, decimals, { maxDp: 2, minDp: 2 }));
  const signed = (base: bigint) => `${base > 0n ? "+" : base < 0n ? "−" : ""}${money(base < 0n ? -base : base)}`;
  const done = match.status === "finalized";
  const winner = !done ? null : view.creatorPnlBase === view.challengerPnlBase ? null : view.creatorPnlBase > view.challengerPnlBase ? match.creator : match.challenger;
  const card: DuelCard | null =
    done && decimals !== null
      ? {
          matchId,
          verdict: winner === null ? "tied" : winner === match.creator ? "won" : "lost",
          returnPct: null,
          you: match.creator,
          opponent: match.challenger,
          hits: view.picks.filter((p) => p.seat === 0 && p.settled && p.payoutBase > p.costBase).length,
          total: match.deckSize,
          pnlBase: view.creatorPnlBase,
          potAwardedBase: match.potBase === 0n ? null : winner === null ? match.potBase : match.potBase * 2n,
          free: match.potBase === 0n,
          decimals,
          symbol,
        }
      : null;

  return (
    <>
      <Plate>
        <Key>{words.title}</Key>
        <View style={styles.seats}>
          <Seat address={match.creator} line={done ? signed(view.creatorPnlBase) : null} won={winner === match.creator} />
          <Text style={[styles.vs, { color: color.inkMuted }]}>vs</Text>
          <Seat address={match.challenger} line={done ? signed(view.challengerPnlBase) : null} won={winner === match.challenger} />
        </View>
        <Body>{done ? (winner === null ? words.tied : words.wonBy(shortHex(winner, 6, 4))) : (words.status[match.status] ?? match.status)}</Body>
        <Foot>{words.readOnly}</Foot>
        {card ? <Button label={DUEL.result.modal.share} onPress={() => setModalOpen(true)} icon={{ ios: "square.and.arrow.up", android: "share" }} /> : null}
      </Plate>

      <Plate>
        <Key>{words.cards}</Key>
        {cardsInMask((1 << match.deckSize) - 1, match.deckSize).map((cardIndex) => {
          const picks = view.picks.filter((p) => p.cardIndex === cardIndex);
          return (
            <View key={cardIndex} style={[styles.row, { borderTopColor: color.hairline }]}>
              <Text style={[styles.cardName, { color: color.ink }]}>
                {words.card(cardIndex + 1)} <Text style={{ color: color.inkMuted }}>{shortHex(view.cards[cardIndex] ?? "", 8, 4)}</Text>
              </Text>
              {picks.length === 0 ? <Foot>{words.unplayed}</Foot> : null}
              {picks.map((p) => (
                <View key={p.seat} style={styles.pickRow}>
                  <View style={[styles.dot, { backgroundColor: p.pick === "up" ? color.profit : color.loss }]} />
                  <Text style={[styles.pick, { color: color.inkSecondary }]}>
                    {p.seat === 0 ? shortHex(match.creator, 4, 3) : shortHex(match.challenger, 4, 3)} · {p.pick} · {p.settled ? `${signed(p.payoutBase - p.costBase)} ${symbol}` : words.open}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
      </Plate>

      {card ? <DuelResultModal open={modalOpen} onClose={() => setModalOpen(false)} card={card} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  seats: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  vs: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1 },
  row: { gap: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  cardName: { fontFamily: FONT.dataStrong, fontSize: 13 },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pick: { fontFamily: FONT.data, fontSize: 11 },
});
