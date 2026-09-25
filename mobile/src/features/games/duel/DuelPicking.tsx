import type { DeckCard, MatchState } from "@agari/core/games";
import type { Hash32 } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import type { DuelRoom } from "@/features/games/duel/useDuelRoom";
import { Cta, PulseDot } from "~/features/games/frame";
import { FONT } from "~/theme";
import { clockUrgency, SwipeDeck, useStageTokens, type DeckPlace } from "../stage";
import { DuelFace } from "./DuelFace";
import { Body, Foot, Key, Plate, PlateTitle, Quiet, Refusal } from "./parts";
import { usePicking } from "./usePicking";

/**
 * web's `DuelPicking.tsx` (`.du-picking`): the swipe, with money behind it — the same `SwipeDeck` as Practice. Above
 * the deck, the opponent's absence (when the room says so) and the pick window draining full width in the clock's
 * colour; a dry key's refusal with its two cranks; under it, the opponent's live cue and your picks as the chain
 * filled them. Once the window has closed, the dead-duel plate names the permissionless lock.
 */
export function DuelPicking({ state, wallet, room }: { state: Extract<MatchState, { phase: "picking" }>; wallet: string | null; room: DuelRoom }) {
  const { s, color } = useStageTokens();
  const p = usePicking(state, wallet, room);
  const { busy, progress, canSign, lock } = p.writes;
  const money = (base: bigint | null) => (base === null || p.decimals === null ? "—" : formatBaseUnits(base, p.decimals, { maxDp: 2, minDp: 0 }));
  const stake = `${money(p.stakeBase)} ${p.symbol}`;
  const nowMs = p.nowMs || undefined;
  const renderFace = useCallback((card: DeckCard, place: DeckPlace) => <DuelFace card={card} place={place} nowMs={nowMs} stake={stake} />, [nowMs, stake]);

  if (p.dead) {
    const body = p.active !== null && p.opponentUnfinished ? DUEL.picking.deadBoth : p.active !== null ? DUEL.picking.deadYou : DUEL.picking.deadOpponent;
    return (
      <Plate>
        <PlateTitle>{DUEL.picking.deadTitle}</PlateTitle>
        <Body>{body}</Body>
        <Foot>{DUEL.picking.deadNote}</Foot>
        {canSign ? <Cta label={busy === "lock" ? DUEL.picking.locking : DUEL.picking.lockCta} disabled={busy !== null} onPress={() => void lock(state.matchId as Hash32)} /> : null}
      </Plate>
    );
  }

  const urgency = clockUrgency(p.leftSec);
  const drainInk = urgency.level === "calm" ? color.profit : urgency.level === "near" ? color.accent : color.loss;
  const hint = progress
    ? DUEL.picking.placing(progress.attempt)
    : p.failed !== null
      ? DUEL.picking.failed
      : p.lastAuto
        ? DUEL.picking.autoNote(p.lastAuto.pick)
        : p.keyed
          ? DUEL.picking.keySwipes
          : DUEL.picking.raceNote;

  return (
    <View style={styles.picking} accessibilityLabel={DUEL.picking.title}>
      {p.opponentAway ? <Pending>{DUEL.picking.opponentAway}</Pending> : null}
      <View style={[styles.deplete, { backgroundColor: s.deplete }]} accessibilityRole="progressbar" accessibilityLabel={`${DUEL.picking.deadline}: ${p.leftSec}s`}>
        <View style={[styles.depleteFill, { width: `${p.depleted * 100}%`, backgroundColor: drainInk }]} />
      </View>
      {p.dry ? (
        <Refusal>
          <Body>{DUEL.picking.keyGasShortWhy}</Body>
          <View style={styles.cranks}>
            {p.sponsorConfigured ? <Quiet label={DUEL.picking.askSponsor} disabled={busy !== null} onPress={p.askSponsor} /> : null}
            <Quiet
              label={busy === "fund" ? DUEL.picking.funding : DUEL.picking.fundKey(formatBaseUnits(p.topUpLamports, 9, { maxDp: 6, minDp: 0 }))}
              disabled={busy !== null}
              onPress={p.fundFromWallet}
            />
          </View>
          {p.asked ? <Foot>{p.asked.ok ? DUEL.lobby.sponsorFunded(formatBaseUnits(p.asked.amountWei, 9, { maxDp: 6, minDp: 0 })) : DUEL.lobby.sponsorDeclined(p.asked.error)}</Foot> : null}
        </Refusal>
      ) : null}
      <SwipeDeck
        cards={state.cards}
        active={p.active}
        playedSide={p.playedSide}
        onPick={p.onPick}
        busy={busy !== null}
        refusal={p.held}
        odds={p.odds}
        renderFace={renderFace}
        hint={hint}
      />
      {p.opponentHere ? <Pending>{DUEL.picking.opponentDeciding}</Pending> : null}
      {p.mine.length > 0 ? (
        <View style={styles.picked}>
          <Key>{DUEL.picking.yourPicks}</Key>
          <View style={styles.pickedList}>
            {[...p.mine]
              .sort((a, b) => a.cardIndex - b.cardIndex)
              .map((receipt) => {
                const card = state.cards.find((c) => c.index === receipt.cardIndex);
                return (
                  <View key={receipt.pickKey} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: receipt.pick === "up" ? color.profit : color.loss }]} />
                    <Text style={[styles.v, { color: color.ink }]}>{card?.asset ?? "—"}</Text>
                    <Key>{receipt.pick}</Key>
                    <Text style={[styles.foot, { color: color.inkSecondary }]}>
                      {DUEL.picking.filled(receipt.quantity.toString(), money(receipt.costBase), p.symbol)}
                      {p.autoPlayed.includes(receipt.cardIndex) ? ` · ${DUEL.picking.autoPlayed}` : ""}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** `.du-pending`: a pulsing vermilion dot and a mono 10 line, for the opponent's presence cues. */
function Pending({ children }: { children: string }) {
  const { color } = useStageTokens();
  return (
    <View style={styles.pending} accessibilityRole="text" accessibilityLiveRegion="polite">
      <PulseDot color={color.accent} />
      <Text style={[styles.pendingText, { color: color.accent }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  picking: { gap: 16 },
  deplete: { height: 4, borderRadius: 9999, overflow: "hidden" },
  depleteFill: { height: "100%", borderRadius: 9999 },
  cranks: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 16 },
  pending: { flexDirection: "row", alignItems: "center", gap: 6 },
  pendingText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  picked: { gap: 8 },
  pickedList: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 },
  dot: { width: 7, height: 7, borderRadius: 9999 },
  v: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  foot: { flexBasis: "100%", fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
