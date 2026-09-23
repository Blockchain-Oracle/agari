import { nameOf, type DeskMandate } from "@agari/core/desk";
import { DESK } from "@/features/desk/copy";
import { usd } from "@/features/desk/format";
import { pctLabel } from "@/features/desk/studio/studio-model";
import type { QuoteLine } from "~/components/kit";

/**
 * A review line whose words are too long for the value column: the sentence moves under the label, the value keeps a
 * short figure, so the kit's one-line value never squeezes its label away on a phone.
 */
export const said = (label: string, value: string, sentence: string): QuoteLine => ({ label, value, hint: sentence });

/** What a mandate signature commits to: every company and the cash by share, the balance, the program's limits. */
export function mandateLines(m: DeskMandate, practiceCashE6: bigint | null): QuoteLine[] {
  return [
    ...m.targets.tokens.map((t) => ({ label: nameOf(t.symbol), value: pctLabel(t.weightBps) })),
    ...(m.targets.cashBps > 0 ? [{ label: DESK.studio.basket.cash, value: pctLabel(m.targets.cashBps) }] : []),
    ...(practiceCashE6 !== null ? [{ label: DESK.studio.read.practiceCash, value: usd(practiceCashE6, 0) }] : []),
    { label: DESK.studio.side.perAction, value: usd(m.perActionCapE6, 0) },
    { label: DESK.studio.side.daily, value: usd(m.dailyCapE6, 0) },
    said("Network", "None", DESK.network.practice),
  ];
}
