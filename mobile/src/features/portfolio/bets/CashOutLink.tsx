import { CASH_OUT, useCashOut, type CashOutTarget } from "@/features/markets/portfolio/useCashOut";
import { RowNote, TextAction } from "./RowParts";

/** web `CashOutLink`: the plain cash-out (L-35) as the row's underlined link, its refusal as a sentence under it. */
export function CashOutLink(target: CashOutTarget) {
  const { canSign, busy, note, cashOut } = useCashOut(target);
  if (!canSign) return null;
  return (
    <>
      <TextAction label={busy ? CASH_OUT.cashingOut : CASH_OUT.cashOut} disabled={busy} onPress={() => void cashOut()} />
      <RowNote text={note} />
    </>
  );
}
