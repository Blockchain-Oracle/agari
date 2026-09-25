import { formatCadence } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import { useQueryClient } from "@tanstack/react-query";
import { VAULT } from "@/features/vault/copy";
import { invalidateVaultOpenBets, type VaultOpenBet } from "@/features/vault/useVaultOpenBets";
import { PORTFOLIO } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { clockLeft, heldSide, sidesWord } from "../format";
import { CashOutLink } from "./CashOutLink";
import { BetsRow, Break, Call, Caption, Micro, MoneyText, Status } from "./RowParts";

/** web `VaultBetRow`: `BetRow`'s grammar with the seat named; staked at cost and why that is all it says; cash-out from the vault's slot. */
export function VaultBetRow({ bet, symbol, nowMs, first }: { bet: VaultOpenBet; symbol: string | undefined; nowMs: number; first: boolean }) {
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const settling = nowMs > 0 ? countdown(nowMs, bet.expirySec, bet.intervalSec).settling : false;
  const side = heldSide(bet.heldUpRaw, bet.heldDownRaw);
  const left = clockLeft(bet.expirySec, bet.intervalSec, nowMs);
  return (
    <BetsRow first={first}>
      <Status word={settling ? PORTFOLIO.settling : PORTFOLIO.live} dot={settling ? null : "accent"} />
      <Call marketId={bet.marketId} asset={bet.asset} text={`${bet.asset} ${sidesWord(bet.heldUpRaw, bet.heldDownRaw)}`} />
      <Micro>{formatCadence(bet.intervalSec)}</Micro>
      <Micro tone="accent">{VAULT.bets.from}</Micro>
      {!settling && left ? (
        <Caption>
          {left} {PORTFOLIO.left}
        </Caption>
      ) : null}
      <Break />
      {bet.stakeBase !== null ? (
        <Caption>
          {VAULT.bets.staked} <MoneyText value={bet.stakeBase} decimals={bet.decimals} symbol={symbol} />
        </Caption>
      ) : null}
      <Caption tone="muted">{VAULT.bets.unpriced}</Caption>
      {!settling && side ? (
        <CashOutLink
          marketId={bet.marketId}
          side={side}
          heldRaw={side === "up" ? bet.heldUpRaw : bet.heldDownRaw}
          decimals={bet.decimals}
          symbol={symbol}
          route={{ kind: "vault" }}
          onConfirmed={async () => {
            if (address) await invalidateVaultOpenBets(queryClient, address);
          }}
        />
      ) : null}
    </BetsRow>
  );
}
