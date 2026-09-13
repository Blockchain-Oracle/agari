"use client";

import { STAKE_TIERS, stakeTier, type DuelMode, type StakeTierId } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits } from "@masayume/core/units";
import { useArenaState, useBalanceSheet } from "@masayume/markets/react";
import { STT_FAUCETS } from "@masayume/core/constants";
import { useVenue } from "@/features/markets";
import { useWalletSession } from "@/lib/wallet-session";
import { DUEL } from "./copy";
import { useArenaGas } from "./useArenaGas";
import { useGameSponsor } from "./useGameSponsor";
import { waitingIn, type RoomOccupancy } from "./useRoomOccupancy";

export interface DuelEntryProps {
  onFind: (mode: DuelMode, tier: StakeTierId) => void;
  /** False while the socket is down: the search cannot be asked for, and the button says which it is. */
  roomOpen: boolean;
  /**
   * The stake lives in the stage, not here.
   *
   * This component is unmounted and remounted every time the match phase changes — including when a
   * dropped socket puts a queued player back at the entry. Holding the choice locally reset it to
   * Free at exactly that moment, so someone who had picked a 10 tUSDC ranked match could search a
   * different one than they meant to. A money choice does not get to be component-local.
   */
  tierId: StakeTierId;
  onTier: (tier: StakeTierId) => void;
  /** Who is already waiting, per stake. Read with no wallet, so it is here before the search is. */
  occupancy: RoomOccupancy | null;
}

/**
 * Choosing a mode and a stake, with what it costs said before anything is signed.
 *
 * Three things are read rather than asserted. The arena says whether it is paused and which tiers it
 * actually prices, and the amounts quoted here are **the contract's**, not the table's — the table in
 * core says what was asked for, the arena says what it will take, and a screen has to quote the
 * second. The wallet's own balance is compared to that pot, so "not enough" is answered here rather
 * than by a revert. And the gas line names the payer as a fact of this deployment, read before the
 * prompt: the sponsor when one is configured and funded, the player's own STT otherwise.
 */
export function DuelEntry({ onFind, roomOpen, tierId, onTier, occupancy }: DuelEntryProps) {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const arena = useArenaState();
  const sheet = useBalanceSheet(address);
  const { gas, recheck } = useArenaGas();
  // Who pays the picks' gas, read before anything is signed — doc 04's "show payer before asking for a signature".
  const sponsor = useGameSponsor();

  const tier = stakeTier(tierId);
  const state = arena && isOk(arena) ? arena.value : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;

  const index = STAKE_TIERS.findIndex((t) => t.id === tierId);
  const arenaTier = state?.tiers[index];
  const potBase = arenaTier?.potBase ?? null;
  const capBase = arenaTier?.perCardCapBase ?? null;

  const notDeployed = arena !== null && isOk(arena) && arena.value === null;
  const paused = state?.paused === true;
  // Unknown is not disabled: while the arena read is in flight the entry stays open rather than
  // telling someone their stake is off when nothing has answered yet.
  const enabled = arenaTier ? arenaTier.enabled : true;

  const spendable = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const short = potBase !== null && potBase > 0n && spendable !== null && spendable < potBase;

  /** Never a guessed decimals: without the boot fact an amount is a dash, not a wrong number. */
  const money = (base: bigint | null) => (base === null || decimals === null ? "—" : formatBaseUnits(base, decimals, { maxDp: 2, minDp: 0 }));

  /**
   * An empty gas tank blocks the search itself.
   *
   * Not a warning beside an enabled button: every step of a duel — the creation, the join, each pick —
   * is a transaction this wallet signs and funds, so a player with no STT cannot complete one, and
   * letting them queue costs a real opponent a real pairing.
   */
  const gasShort = gas.kind === "short";
  const blocked = paused || notDeployed || !enabled || short || !roomOpen || gasShort;

  return (
    <section className="du-entry" aria-label={DUEL.entry.tier}>
      <div className="du-choices">
        <span className="du-k">{DUEL.entry.tier}</span>
        <div className="du-tiers" role="radiogroup" aria-label={DUEL.entry.tier}>
          {STAKE_TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === tierId}
              className={`du-tier${t.id === tierId ? " du-tier--on" : ""}`}
              onClick={() => onTier(t.id)}
            >
              <span className="du-tier-name">{t.mode === "free" ? DUEL.entry.free : DUEL.entry.ranked}</span>
              <span className="du-tier-amount">{t.potUnits === 0 ? DUEL.entry.tierFree : DUEL.entry.tierUnits(t.potUnits, symbol)}</span>
            </button>
          ))}
        </div>
        <p className="du-blurb">{tier.mode === "free" ? DUEL.entry.freeBlurb : DUEL.entry.rankedBlurb}</p>
        {/* Per stake, not in total: a player choosing Ranked 10 must not be told about the Free queue. */}
        {occupancy?.reachable && <p className="du-foot">{DUEL.entry.queueHere(waitingIn(occupancy, tier.mode, tierId))}</p>}
      </div>

      <div className="du-cost">
        <span className="du-k">{DUEL.entry.cost}</span>
        <ul className="du-cost-list">
          <li>{tier.potUnits === 0 ? DUEL.entry.costNoPot : DUEL.entry.costPot(money(potBase), symbol)}</li>
          <li>{DUEL.entry.costCards(money(capBase), symbol)}</li>
          <li>{sponsor.ready ? DUEL.entry.costGasSponsored : DUEL.entry.costGas}</li>
        </ul>
      </div>

      {notDeployed && <p className="du-refusal">{DUEL.entry.notDeployed}</p>}
      {paused && <p className="du-refusal">{DUEL.entry.paused}</p>}
      {!paused && !notDeployed && !enabled && <p className="du-refusal">{DUEL.entry.tierDisabled}</p>}
      {short && <p className="du-refusal">{DUEL.entry.balanceShort(money(potBase), money(spendable), symbol)}</p>}
      {gasShort && (
        <div className="du-refusal" role="status">
          <p className="du-body">{sponsor.ready ? DUEL.entry.gasShortSponsored : DUEL.entry.gasShort}</p>
          <ul className="du-faucets">
            {STT_FAUCETS.map((faucet) => (
              <li key={faucet.url}>
                <a href={faucet.url} target="_blank" rel="noreferrer">
                  {faucet.name} →
                </a>
              </li>
            ))}
          </ul>
          <button type="button" className="du-quiet" onClick={() => void recheck()}>
            {DUEL.entry.gasRecheck}
          </button>
        </div>
      )}

      <button type="button" className="du-cta" disabled={blocked} onClick={() => onFind(tier.mode, tierId)}>
        {roomOpen ? DUEL.entry.find : DUEL.entry.waitingRoom}
      </button>
    </section>
  );
}
