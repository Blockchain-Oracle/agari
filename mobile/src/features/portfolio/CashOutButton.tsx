import { formatBaseUnits } from "@agari/core/units";
import { CASH_OUT } from "@/features/markets/portfolio/useCashOut";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { Button, type QuoteLine } from "~/components/kit";
import { pnlTone } from "./format";
import { SignSheet } from "./SignSheet";
import { useCashOutReview, type CashOutTarget } from "./useCashOutReview";
import { useSignFlow } from "./useSignFlow";

interface Props extends CashOutTarget {
  /** What this holding cost, when the venue recorded it; null reads as "not recorded", never as free. */
  costBase: bigint | null;
  /** "BTC · 5m", the review's title. */
  windowLabel: string;
}

/**
 * The plain cash-out (L-35) on an open bet: tapping reads a fresh exit quote, the sheet shows exactly what the Book
 * pays — contracts, expected proceeds, the floor the sell may not go under — and the result against the cost; the
 * slide sends it. Only offered where a wallet can sign, as web's `CashOutLink`.
 */
export function CashOutButton({ costBase, windowLabel, ...target }: Props) {
  const cash = useCashOutReview(target);
  const flow = useSignFlow();
  if (!cash.canSign) return null;

  const { quote, money } = cash;
  const d = target.decimals;
  const lines: QuoteLine[] = [];
  let maxLoss: string | null = null;
  let blocker: string | null = null;
  if (quote.kind === "quoting" || quote.kind === "idle") blocker = "Reading the Book…";
  if (quote.kind === "refused") blocker = quote.note;
  if (quote.kind === "ready") {
    const { exit } = quote;
    lines.push({ label: "Selling", value: `${formatBaseUnits(exit.contractsRaw, d, { minDp: 0 })} ${SIDE_WORD[target.side]} contracts` });
    if (exit.contractsRaw < target.heldRaw) lines.push({ label: "Stays open", value: `${formatBaseUnits(target.heldRaw - exit.contractsRaw, d, { minDp: 0 })} contracts`, hint: "the Book cannot fill more right now" });
    lines.push({ label: "Expected proceeds", value: money(exit.expectedProceedsBase), tone: "accent" });
    lines.push({ label: "Pays at least", value: money(exit.minProceedsBase), hint: "the protective floor; below it nothing sells" });
    lines.push({ label: "Average price", value: `${(exit.avgPriceBps / 100).toFixed(1)}¢` });
    if (costBase !== null) {
      lines.push({ label: "Your cost", value: money(costBase) });
      const atFloor = exit.minProceedsBase - costBase;
      lines.push({ label: "Result at the floor", value: `${formatBaseUnits(atFloor, d, { signed: true })} ${target.symbol ?? ""}`.trim(), tone: pnlTone(atFloor) });
      maxLoss = money(atFloor < 0n ? -atFloor : 0n);
    } else {
      lines.push({ label: "Your cost", value: "not recorded" });
      maxLoss = money(0n);
    }
  }

  return (
    <>
      <Button
        label={CASH_OUT.cashOut}
        variant="outline"
        size="sm"
        block={false}
        onPress={() => {
          flow.start();
          void cash.load();
        }}
      />
      <SignSheet
        visible={flow.open}
        onClose={flow.close}
        title={`${CASH_OUT.cashOut} · ${windowLabel}`}
        lines={lines}
        maxLoss={maxLoss}
        confirmLabel="Slide to cash out"
        onConfirm={() => void flow.run(cash.confirm)}
        phase={flow.phase}
        blocker={blocker}
        outcome={flow.outcome}
      />
    </>
  );
}
