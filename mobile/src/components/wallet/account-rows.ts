import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useBalancePlate } from "@/features/markets/balance/useBalancePlate";
import { ACCOUNT_MENU } from "@/lib/copy";

const AMOUNT_DP = 2;

/** web's account menu rows (HeaderAccount): the trading account and the wallet balance, an em dash until read. */
export function useAccountBalances(): { label: string; amount: string }[] {
  const balance = useBalancePlate();
  const reading = balance.kind === "connected" ? balance.reading : null;
  const sheet = reading && isOk(reading) ? reading.value : null;
  const amount = (value: bigint | null) => (sheet && value !== null ? formatBaseUnits(value, sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) : "—");
  return [
    { label: ACCOUNT_MENU.tradingAccount, amount: amount(sheet?.vaultBase ?? null) },
    { label: ACCOUNT_MENU.wallet, amount: amount(sheet?.spendableBase ?? null) },
  ];
}
