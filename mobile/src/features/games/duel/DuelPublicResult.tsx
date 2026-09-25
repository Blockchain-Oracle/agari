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
import { LoadingState } from "~/components/kit";
import { Cta } from "~/features/games/frame";
import { FONT } from "~/theme";
import { DuelResultModal } from "./DuelResultModal";
import { Avatar, Body, Foot, Key, Plate, Refusal, useDuelTokens } from "./parts";

/**
 * web's `DuelPublicResult.tsx` (`.du-result.du-public`): `/games/duel/[matchId]` for anyone not seated in it — both
 * seats with their PnL, the verdict, the read-only line and the share, then every card's two picks, read straight
 * off the arena with no wallet and no room.
 */
export function DuelPublicResult({ matchId }: { matchId: Hash32 }) {
  const { color } = useDuelTokens();
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
    <View style={styles.result} accessibilityLabel={words.title}>
      <Plate>
        <Key>{words.title}</Key>
        <View style={styles.seats}>
          <PublicSeat address={match.creator} pnl={done ? signed(view.creatorPnlBase) : null} won={winner === match.creator} />
          <Text style={[styles.vs, { color: color.inkMuted }]}>vs</Text>
          <PublicSeat address={match.challenger} pnl={done ? signed(view.challengerPnlBase) : null} won={winner === match.challenger} />
        </View>
        <Body>{done ? (winner === null ? words.tied : words.wonBy(shortHex(winner, 6, 4))) : (words.status[match.status] ?? match.status)}</Body>
        <Foot>{words.readOnly}</Foot>
        {card ? <Cta label={DUEL.result.modal.share} onPress={() => setModalOpen(true)} /> : null}
      </Plate>

      <Plate>
        <Key>{words.cards}</Key>
        <View style={styles.list}>
          {cardsInMask((1 << match.deckSize) - 1, match.deckSize).map((cardIndex) => {
            const picks = view.picks.filter((p) => p.cardIndex === cardIndex);
            return (
              <View key={cardIndex} style={styles.row}>
                <Text style={[styles.v, { color: color.ink }]}>{words.card(cardIndex + 1)}</Text>
                <Key>{shortHex(view.cards[cardIndex] ?? "", 8, 4)}</Key>
                {picks.length === 0 ? <Text style={[styles.foot, { color: color.inkSecondary }]}>{words.unplayed}</Text> : null}
                {picks.map((p) => (
                  <View key={p.seat} style={styles.pick}>
                    <View style={[styles.dot, { backgroundColor: p.pick === "up" ? color.profit : color.loss }]} />
                    <Text style={[styles.foot, { color: color.inkSecondary }]}>
                      {p.seat === 0 ? shortHex(match.creator, 4, 3) : shortHex(match.challenger, 4, 3)} · {p.pick} · {p.settled ? `${signed(p.payoutBase - p.costBase)} ${symbol}` : words.open}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </Plate>

      {card ? <DuelResultModal open={modalOpen} onClose={() => setModalOpen(false)} card={card} /> : null}
    </View>
  );
}

/** The public page's `.du-seat`: the avatar, the short address, and the seat's PnL at 11 (profit ink for the winner). */
function PublicSeat({ address, pnl, won }: { address: string; pnl: string | null; won: boolean }) {
  const { color } = useDuelTokens();
  return (
    <View style={styles.seat}>
      <Avatar address={address} />
      <View style={styles.seatName}>
        <Text style={[styles.addr, { color: color.ink }]}>{shortHex(address, 6, 4)}</Text>
        {pnl ? <Text style={[styles.pnl, { color: won ? color.profit : color.inkMuted }]}>{pnl}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  result: { gap: 12 },
  seats: { flexDirection: "row", alignItems: "center", gap: 14 },
  seat: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  seatName: { gap: 2 },
  addr: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  pnl: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32 },
  vs: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1 },
  list: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 },
  v: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  pick: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 9999 },
  foot: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
