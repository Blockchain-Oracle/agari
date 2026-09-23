import { STAKE_TIERS, everyCardSettled, picksComplete, type MatchState } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { Address, Hash32, MarketId } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useArenaCredit, useArenaState, useMarketsLite } from "@agari/markets/react";
import { useEffect, useRef, useState } from "react";
import { DUEL } from "@/features/games/duel/copy";
import type { DuelCard } from "@/features/games/duel/duel-card";
import { useArenaWrites } from "@/features/games/duel/useArenaWrites";
import { useVenue } from "@/features/markets/useVenue";
import { Button, SignReview } from "~/components/kit";
import { LockedInMark } from "../shell/PixelArt";
import { useStageFeel } from "../stage";
import { DuelResultModal } from "./DuelResultModal";
import { Body, Foot, Key, Plate, PlateTitle, Quiet, Value } from "./parts";
import { ReceiptRows, Verdict } from "./ResultParts";

type ResultState = Extract<MatchState, { phase: "locked" | "settling" | "finalized" | "forfeited" }>;

/**
 * web's `DuelResult.tsx`: the lock, the settlement card by card, the verdict with real PnL (never "score"), the
 * permissionless cranks, and what the arena holds for this wallet with the claim. The verdict opens the result
 * sheet once, with duel-win / duel-lose; each card that settles live rings card-win / card-loss.
 */
export function DuelResult({ state, wallet }: { state: ResultState; wallet: string | null }) {
  const { boot } = useVenue();
  const credit = useArenaCredit((wallet as Address | null) ?? null);
  const { claim, settleCard, finalize, busy, canSign } = useArenaWrites();
  const { feedback } = useStageFeel();
  const arena = useArenaState();
  const [claiming, setClaiming] = useState(false);

  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const money = (base: bigint | null) => (base === null || decimals === null ? DUEL.result.unsettled : formatBaseUnits(base, decimals, { maxDp: 4, minDp: 2 }));
  const you = wallet;
  const receipts = "receipts" in state ? state.receipts : [];
  const cards = "cards" in state ? state.cards : [];
  const settled = receipts.filter((r) => r.payoutBase !== null).length;
  const owed = credit && isOk(credit) ? credit.value : null;
  const mine = receipts.filter((r) => r.player === you);

  const lite = useMarketsLite(cards.map((c) => c.marketId as MarketId));
  const decided = (marketId: string) => {
    if (!lite || !isOk(lite)) return false;
    const market = lite.value.get(marketId as MarketId);
    return market !== undefined && (market.status === "Resolved" || market.voided);
  };
  const outstanding = cards.filter((card) => decided(card.marketId) && receipts.some((r) => r.cardIndex === card.index && r.payoutBase === null));
  const canFinalize = state.phase !== "finalized" && receipts.length > 0 && receipts.every((r) => r.payoutBase !== null);

  const outcome = state.phase === "finalized" ? state.outcome : null;
  const yourPnl = outcome && you ? (Object.entries(outcome.pnlBase).find(([addr]) => addr === you)?.[1] ?? null) : null;
  const theirPnl = outcome && you ? (Object.entries(outcome.pnlBase).find(([addr]) => addr !== you)?.[1] ?? null) : null;

  // One cue per card on a pending→settled transition seen live — never on first load.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const settledNow = new Set(mine.filter((r) => r.payoutBase !== null).map((r) => r.pickKey));
    if (seen.current === null) {
      seen.current = settledNow;
      return;
    }
    for (const receipt of mine) {
      if (receipt.payoutBase === null || seen.current.has(receipt.pickKey)) continue;
      feedback(receipt.payoutBase > receipt.costBase ? "card-win" : "card-loss");
    }
    seen.current = settledNow;
  }, [mine, feedback]);

  const [modalOpen, setModalOpen] = useState(false);
  const sounded = useRef<string | null>(null);
  useEffect(() => {
    if (!outcome || sounded.current === state.matchId) return;
    sounded.current = state.matchId;
    setModalOpen(true);
    feedback(outcome.winner === null ? "modal-open" : outcome.winner === you ? "duel-win" : "duel-lose");
  }, [outcome, state.matchId, you, feedback]);

  const tierPot = arena && isOk(arena) ? (arena.value?.tiers[STAKE_TIERS.findIndex((t) => t.id === state.tier)]?.potBase ?? null) : null;
  const costBase = mine.reduce((sum, r) => sum + r.costBase, 0n);
  const card: DuelCard | null =
    outcome && decimals !== null
      ? {
          matchId: state.matchId,
          verdict: outcome.winner === null ? "tied" : outcome.winner === you ? "won" : "lost",
          returnPct: state.tier === "free" || yourPnl === null || costBase === 0n ? null : Number((yourPnl * 100n) / costBase),
          you,
          opponent: you === null ? null : state.players.creator === you ? state.players.challenger : state.players.creator,
          hits: mine.filter((r) => r.payoutBase !== null && r.payoutBase > r.costBase).length,
          total: cards.length,
          pnlBase: yourPnl,
          potAwardedBase: tierPot === null ? null : outcome.winner === null ? tierPot : tierPot * 2n,
          free: state.tier === "free",
          decimals,
          symbol,
        }
      : null;

  return (
    <>
      {state.phase === "locked" ? (
        <Plate style={{ alignItems: "center" }}>
          <LockedInMark size={56} />
          <PlateTitle>{DUEL.settling.lockedTitle}</PlateTitle>
          <Body>{DUEL.settling.lockedBody}</Body>
        </Plate>
      ) : null}
      {state.phase === "settling" ? (
        <Plate>
          <PlateTitle spinning>{DUEL.settling.title}</PlateTitle>
          <Value>{DUEL.settling.progress(settled, cards.length * 2)}</Value>
          <Body>{DUEL.settling.body}</Body>
        </Plate>
      ) : null}
      {state.phase === "forfeited" ? (
        <Plate>
          <PlateTitle>{DUEL.result.forfeitTitle}</PlateTitle>
          <Body>{DUEL.result.forfeitBody}</Body>
        </Plate>
      ) : null}

      {outcome ? (
        <Verdict outcome={outcome} you={you} yourPnl={yourPnl} theirPnl={theirPnl} money={money} symbol={symbol} free={state.tier === "free"}>
          {card && !modalOpen ? <Quiet label={DUEL.result.modal.reopen} onPress={() => setModalOpen(true)} /> : null}
        </Verdict>
      ) : null}
      {card ? <DuelResultModal open={modalOpen} onClose={() => setModalOpen(false)} card={card} /> : null}

      {receipts.length > 0 ? <ReceiptRows receipts={receipts} cards={cards} you={you} money={money} symbol={symbol} /> : null}

      {canSign && (outstanding.length > 0 || canFinalize) ? (
        <Plate>
          <Key>{DUEL.settling.crankTitle}</Key>
          <Body>{DUEL.settling.crankBody}</Body>
          {outstanding.map((c) => (
            <Quiet
              key={c.index}
              label={busy === `settle:${c.index}` ? DUEL.settling.settling : DUEL.settling.settleCard(c.asset)}
              disabled={busy !== null}
              onPress={() => void settleCard(state.matchId as Hash32, c.index)}
            />
          ))}
          {canFinalize ? (
            <Quiet label={busy === "finalize" ? DUEL.settling.finalizing : DUEL.settling.finalize} disabled={busy !== null} onPress={() => void finalize(state.matchId as Hash32)} />
          ) : null}
        </Plate>
      ) : null}

      <Plate>
        <Key>{DUEL.result.credit}</Key>
        <Value>{owed === null ? DUEL.result.unsettled : `${money(owed)} ${symbol}`}</Value>
        {owed !== null && owed > 0n && canSign && wallet ? (
          claiming || busy === "claim" ? (
            <SignReview
              title={DUEL.result.claim}
              lines={[{ label: DUEL.result.credit, value: `${money(owed)} ${symbol}`, tone: "profit" }]}
              maxLoss={null}
              confirmLabel="Slide to claim"
              tone="profit"
              phase={busy === "claim" ? "signing" : "review"}
              onConfirm={() => void claim(wallet as Address).then(() => setClaiming(false))}
            />
          ) : (
            <Button label={DUEL.result.claim} variant="profit" onPress={() => setClaiming(true)} disabled={busy !== null} />
          )
        ) : null}
        {owed === 0n ? <Body>{DUEL.result.nothingToClaim}</Body> : null}
        <Foot>{DUEL.result.claimNote}</Foot>
      </Plate>

      {picksComplete(cards, receipts) && !everyCardSettled(cards, receipts) && state.phase !== "finalized" ? <Foot>{DUEL.settling.waitingCard}</Foot> : null}
    </>
  );
}
