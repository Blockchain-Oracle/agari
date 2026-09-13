"use client";

import type { BookedOrder } from "@masayume/core/ports";
import { isOk } from "@masayume/core/schemas";
import { belowMinStake, minStakeBase } from "@masayume/core/sizing";
import type { Hex } from "@masayume/core/types";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@masayume/core/units";
import { useBalanceSheet, useSigner } from "@masayume/markets/react";
import { useCallback, useState } from "react";
import { useVenue } from "@/features/markets";
import { QuickChips } from "@/features/markets/ticket/QuickChips";
import { usePersistedState } from "@/lib/persisted";
import { useWalletSession } from "@/lib/wallet-session";
import { useGames } from "../GamesProvider";
import { LUCKY } from "./copy";
import { LuckyDeal } from "./LuckyDeal";
import { LuckyFailedPlate, LuckyPlacedPlate, LuckyRefusedPlate } from "./LuckyPlates";
import { LuckyReels } from "./LuckyReels";
import { LuckySide } from "./LuckySide";
import type { LuckyPlacedStatus } from "./lucky-wire";
import { reelSpin } from "./reel-sfx";
import { useLuckyDraw } from "./useLuckyDraw";
import "./lucky.css";

/**
 * `/games/lucky` — Pips' hero, on DreamDEX: set a stake, SPIN, the three reels land on a draw two seeds
 * made, the deal card shows the Window and the live quote with the proof beside them, and one tap places
 * one real order through the same lane as every Ticket. Stake first (Pips: the player only sets the bet);
 * the chips reuse the Ticket's own, and the stake must clear the venue's floor before the reels move.
 */

const STAKE_KEY = "masayume.games.luckyStake";
const stakeCodec = { parse: (raw: string) => (/^\d*\.?\d*$/.test(raw) ? raw : null), serialize: (v: string) => v };

function sanitize(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

export function LuckyStage() {
  const session = useWalletSession();
  const { address, hasSigner } = useSigner();
  const { boot } = useVenue();
  const { feedback } = useGames();
  const draw = useLuckyDraw();
  const [stakeText, setStakeText] = usePersistedState(STAKE_KEY, "1", stakeCodec);
  const [skipping, setSkipping] = useState(false);

  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const sheet = useBalanceSheet(address);
  const balances = sheet?.ok ? sheet.value : null;
  const availableBase = balances ? balances.spendableBase + balances.venueCreditBase : null;
  const stakeBase = decimals === null ? 0n : (parseDecimalToBaseUnits(stakeText, decimals) ?? 0n);
  const belowMin = decimals !== null && stakeBase > 0n && belowMinStake(stakeBase, decimals);
  const floorText = decimals === null ? "" : `${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`;

  const { phase } = draw;
  const busy = phase.kind === "committing" || phase.kind === "spinning";
  const atRest = phase.kind === "idle" || phase.kind === "placed" || phase.kind === "refused" || phase.kind === "failed";
  const spinBlock = !session.isConnected
    ? LUCKY.spin.connect
    : !session.isRightChain
      ? LUCKY.spin.wrongChain
      : !hasSigner || !address || decimals === null
        ? LUCKY.spin.noSigner
        : stakeBase === 0n || belowMin
          ? LUCKY.stake.minimum(floorText)
          : null;
  const canSpin = atRest && spinBlock === null;

  const onSpin = () => {
    if (!canSpin || !address) return;
    feedback("tap");
    reelSpin();
    draw.reset();
    void draw.spin(address, stakeBase);
  };

  const onReport = useCallback((status: LuckyPlacedStatus, txHash: Hex | null, booked: BookedOrder | null) => void draw.report(status, txHash, booked), [draw]);
  const onSkip = async () => {
    setSkipping(true);
    await draw.report("declined", null, null);
    setSkipping(false);
  };

  const dealt = phase.kind === "dealt" ? phase.deal : null;

  return (
    <div className="container gm-page">
      <header className="lk-head">
        <span className="gm-eyebrow">{LUCKY.eyebrow}</span>
        <h1 className="lk-title">
          {LUCKY.title}
          <span className="accent">.</span>
        </h1>
      </header>

      <div className="lk-layout">
        <div className="lk-stage">
          <section className="lk-cabinet" aria-label={LUCKY.title}>
            <LuckyReels cycling={draw.cycling} landing={draw.landing} target={draw.target} onLanded={draw.landed} />

            <div className="lk-stake">
              <div className="lk-stake-head">
                <span className="lk-stake-k">{LUCKY.stake.label}</span>
                {availableBase !== null && decimals !== null && <span className="lk-stake-avail">{LUCKY.stake.available(`${formatBaseUnits(availableBase, decimals)} ${symbol}`)}</span>}
              </div>
              <div className="lk-stake-field">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  className="lk-stake-input"
                  placeholder={LUCKY.stake.placeholder}
                  value={stakeText}
                  disabled={busy}
                  aria-label={LUCKY.stake.aria(symbol)}
                  onChange={(event) => setStakeText(sanitize(event.target.value))}
                />
                <span className="lk-stake-unit">{symbol}</span>
              </div>
              {decimals !== null && !busy && <QuickChips availableBase={availableBase} decimals={decimals} onPick={(base) => setStakeText(formatBaseUnits(base, decimals, { group: false, minDp: 0 }))} />}
              {belowMin && <p className="lk-stake-min">{LUCKY.stake.minimum(floorText)}</p>}
            </div>

            <button type="button" className={`lk-cta${busy ? " lk-cta--busy" : ""}`} disabled={!canSpin} onClick={onSpin} aria-label={spinBlock ?? LUCKY.spin.cta}>
              {phase.kind === "committing" ? LUCKY.spin.committing : phase.kind === "spinning" ? (phase.deal ? LUCKY.spin.dealing : LUCKY.spin.spinning) : phase.kind === "idle" ? LUCKY.spin.cta : LUCKY.spin.again}
            </button>
            {spinBlock && atRest && <p className="lk-cta-note">{spinBlock}</p>}
          </section>

          {dealt && <LuckyDeal deal={dealt} symbol={symbol} onReport={onReport} onSkip={() => void onSkip()} skipping={skipping} />}
          {phase.kind === "refused" && <LuckyRefusedPlate deal={phase.deal} onAgain={draw.reset} />}
          {phase.kind === "placed" && <LuckyPlacedPlate deal={phase.deal} placed={phase.placed} booked={phase.booked} symbol={symbol} onAgain={draw.reset} />}
          {phase.kind === "failed" && <LuckyFailedPlate message={phase.message} hadDeal={phase.deal !== null} onAgain={draw.reset} />}
        </div>

        <LuckySide wallet={address ?? null} watchDrawId={phase.kind === "placed" ? phase.deal.drawId : null} decimals={decimals} symbol={symbol} />
      </div>
    </div>
  );
}
