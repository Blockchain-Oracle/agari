import type { DeckCard, MatchState } from "@agari/core/games";
import type { Hash32 } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useCallback } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import type { DuelRoom } from "@/features/games/duel/useDuelRoom";
import { Button } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";
import { clockUrgency, SwipeDeck, type DeckPlace } from "../stage";
import { DuelFace } from "./DuelFace";
import { Body, Foot, Plate, PlateTitle, Quiet, Refusal } from "./parts";
import { usePicking } from "./usePicking";

/**
 * web's `DuelPicking.tsx`: the swipe, with money behind it. The same `SwipeDeck` as Practice. The drain bar is the
 * pick window; the opponent's row is the room's presence and their confirmed picks on chain (never a side).
 */
export function DuelPicking({ state, wallet, room }: { state: Extract<MatchState, { phase: "picking" }>; wallet: string | null; room: DuelRoom }) {
  const { color } = useTheme();
  const p = usePicking(state, wallet, room);
  const headerHeight = useHeaderHeight();
  const top = { paddingTop: (Platform.OS === "ios" ? headerHeight : 0) + 8 };
  const { busy, progress, canSign, lock } = p.writes;
  const money = (base: bigint | null) => (base === null || p.decimals === null ? "—" : formatBaseUnits(base, p.decimals, { maxDp: 2, minDp: 0 }));
  const stake = `${money(p.stakeBase)} ${p.symbol}`;
  const nowMs = p.nowMs || undefined;
  const renderFace = useCallback(
    (card: DeckCard, place: DeckPlace) => <DuelFace card={card} place={place} nowMs={nowMs} stake={stake} />,
    [nowMs, stake],
  );

  if (p.dead) {
    const body = p.active !== null && p.opponentUnfinished ? DUEL.picking.deadBoth : p.active !== null ? DUEL.picking.deadYou : DUEL.picking.deadOpponent;
    return (
      <ScrollView contentContainerStyle={[styles.pad, top]}>
        <Plate>
          <PlateTitle>{DUEL.picking.deadTitle}</PlateTitle>
          <Body>{body}</Body>
          <Foot>{DUEL.picking.deadNote}</Foot>
          {canSign ? (
            <Button label={busy === "lock" ? DUEL.picking.locking : DUEL.picking.lockCta} loading={busy === "lock"} disabled={busy !== null} onPress={() => void lock(state.matchId as Hash32)} />
          ) : null}
        </Plate>
      </ScrollView>
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
    <View style={styles.fill}>
      <View style={[styles.pad, top]}>
        <View style={[styles.drain, { backgroundColor: color.surface2 }]} accessibilityRole="progressbar" accessibilityLabel={`${DUEL.picking.deadline}: ${p.leftSec}s`}>
          <View style={[styles.drainFill, { width: `${p.depleted * 100}%`, backgroundColor: drainInk }]} />
        </View>
        <Opponent here={p.opponentHere} away={p.opponentAway} picks={p.opponentPicks} total={state.cards.length} leftSec={p.leftSec} />
        {p.dry ? (
          <Refusal>
            <Body>{DUEL.picking.keyGasShortWhy}</Body>
            {p.sponsorConfigured ? <Quiet label={DUEL.picking.askSponsor} disabled={busy !== null} onPress={p.askSponsor} /> : null}
            <Quiet
              label={busy === "fund" ? DUEL.picking.funding : DUEL.picking.fundKey(formatBaseUnits(p.topUpLamports, 9, { maxDp: 6, minDp: 0 }))}
              disabled={busy !== null}
              onPress={p.fundFromWallet}
            />
            {p.asked ? (
              <Foot>{p.asked.ok ? DUEL.lobby.sponsorFunded(formatBaseUnits(p.asked.amountWei, 9, { maxDp: 6, minDp: 0 })) : DUEL.lobby.sponsorDeclined(p.asked.error)}</Foot>
            ) : null}
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
        {p.mine.length > 0 ? <Picked state={state} mine={p.mine} autoPlayed={p.autoPlayed} money={money} symbol={p.symbol} /> : null}
      </View>
    </View>
  );
}

/** The opponent's side of the stage: whether they are here, on this card, and how many picks the chain has from them. */
function Opponent({ here, away, picks, total, leftSec }: { here: boolean; away: boolean; picks: number; total: number; leftSec: number }) {
  const { color } = useTheme();
  const dot = away ? color.inkMuted : here ? color.accent : color.profit;
  const line = away ? DUEL.picking.opponentAway : here ? DUEL.picking.opponentDeciding : `${DUEL.result.opponent}: ${picks}/${total}`;
  return (
    <View style={styles.opponent} accessibilityLiveRegion="polite">
      <View style={[styles.opDot, { backgroundColor: dot }]} />
      <Text style={[styles.opText, { color: away ? color.inkMuted : color.inkSecondary }]} numberOfLines={2}>
        {line}
      </Text>
      <View style={styles.opPips}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.opPip, { backgroundColor: i < picks ? color.accent : color.borderStrong }]} />
        ))}
      </View>
      <Text style={[styles.opClock, { color: color.inkMuted }]}>{`${Math.floor(leftSec / 60)}:${String(leftSec % 60).padStart(2, "0")}`}</Text>
    </View>
  );
}

function Picked({ state, mine, autoPlayed, money, symbol }: {
  state: Extract<MatchState, { phase: "picking" }>;
  mine: ReturnType<typeof usePicking>["mine"];
  autoPlayed: readonly number[];
  money: (base: bigint | null) => string;
  symbol: string;
}) {
  const { color } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picked} accessibilityLabel={DUEL.picking.yourPicks}>
      {[...mine]
        .sort((a, b) => a.cardIndex - b.cardIndex)
        .map((receipt) => {
          const card = state.cards.find((c) => c.index === receipt.cardIndex);
          const ink = receipt.pick === "up" ? color.profit : color.loss;
          return (
            <View key={receipt.pickKey} style={[styles.chip, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
              <View style={[styles.opDot, { backgroundColor: ink }]} />
              <Text style={[styles.chipText, { color: color.ink }]}>{card?.asset ?? "—"}</Text>
              <Text style={[styles.chipText, { color: ink }]}>{receipt.pick.toUpperCase()}</Text>
              <Text style={[styles.chipFoot, { color: color.inkMuted }]}>
                {DUEL.picking.filled(receipt.quantity.toString(), money(receipt.costBase), symbol)}
                {autoPlayed.includes(receipt.cardIndex) ? ` · ${DUEL.picking.autoPlayed}` : ""}
              </Text>
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 },
  drain: { height: 4, borderRadius: RADIUS.full, overflow: "hidden" },
  drainFill: { height: 4, borderRadius: RADIUS.full },
  opponent: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 },
  opDot: { width: 8, height: 8, borderRadius: 4 },
  opText: { flex: 1, fontFamily: FONT.data, fontSize: 11, lineHeight: 15 },
  opPips: { flexDirection: "row", gap: 3 },
  opPip: { width: 10, height: 4, borderRadius: 2 },
  opClock: { fontFamily: FONT.data, fontSize: 11, fontVariant: ["tabular-nums"], minWidth: 34, textAlign: "right" },
  picked: { gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, height: 32 },
  chipText: { fontFamily: FONT.dataStrong, fontSize: 11 },
  chipFoot: { fontFamily: FONT.data, fontSize: 10 },
});
