import { estPayoutBase } from "@agari/core/claims";
import { formatCadence } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import { useQueryClient } from "@tanstack/react-query";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { VAULT } from "@/features/vault/copy";
import { invalidateVaultOpenBets, type VaultOpenBet } from "@/features/vault/useVaultOpenBets";
import { PORTFOLIO, TICKET } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { BetLine, type Figure } from "./BetLine";
import { CashOutButton } from "./CashOutButton";
import { clockLeft, heldSide, money, sidesWord } from "./format";

/**
 * web `VaultBetRow`: an open bet the Trading Balance holds — staked at cost (the venue does not price the vault's
 * positions per owner, and the row says so rather than inventing a mark), the payout if it lands, and the cash-out
 * from the vault's slot whose proceeds land back in the Trading Balance.
 */
export function VaultBetRow({ bet, symbol, nowMs }: { bet: VaultOpenBet; symbol: string | undefined; nowMs: number }) {
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const d = bet.decimals;
  const settling = nowMs > 0 ? countdown(nowMs, bet.expirySec, bet.intervalSec).settling : false;
  const side = heldSide(bet.heldUpRaw, bet.heldDownRaw);
  const left = clockLeft(bet.expirySec, bet.intervalSec, nowMs);
  const cadence = formatCadence(bet.intervalSec);

  const figures: Figure[] = [];
  if (bet.stakeBase !== null) figures.push({ label: VAULT.bets.staked, value: money(bet.stakeBase, d, symbol) });
  if (bet.heldUpRaw > 0n) figures.push({ label: TICKET.payoutIfRight(SIDE_WORD.up), value: money(estPayoutBase(bet.heldUpRaw, "win"), d, symbol), tone: "accent" });
  if (bet.heldDownRaw > 0n) figures.push({ label: TICKET.payoutIfRight(SIDE_WORD.down), value: money(estPayoutBase(bet.heldDownRaw, "win"), d, symbol), tone: "accent" });

  return (
    <BetLine
      status={settling ? PORTFOLIO.settling : PORTFOLIO.live}
      live={!settling}
      asset={bet.asset}
      title={`${bet.asset} ${sidesWord(bet.heldUpRaw, bet.heldDownRaw)}`}
      marketId={bet.marketId}
      meta={[cadence, VAULT.bets.from, !settling && left ? `${left} ${PORTFOLIO.left}` : null]}
      figures={figures}
      notes={[VAULT.bets.unpriced]}
      action={
        !settling && side ? (
          <CashOutButton
            marketId={bet.marketId}
            side={side}
            heldRaw={side === "up" ? bet.heldUpRaw : bet.heldDownRaw}
            decimals={d}
            symbol={symbol}
            route={{ kind: "vault" }}
            costBase={bet.stakeBase}
            windowLabel={`${bet.asset} · ${cadence}`}
            onConfirmed={async () => {
              if (address) await invalidateVaultOpenBets(queryClient, address);
            }}
          />
        ) : null
      }
    />
  );
}
