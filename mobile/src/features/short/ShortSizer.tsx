import { diagnosisCopy, formatCadence } from "@agari/core/copy";
import { leverageBpsOf, type LeverageQuote, type LeverageReserveState } from "@agari/core/leverage";
import type { EventMarket } from "@agari/core/types";
import { bpsToOddsCents, formatBaseUnits, parseDecimalToBaseUnits, priceRawToBps } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { useLeverageQuote, useLeverageWrites } from "@/features/leverage";
import { SHORT } from "@/features/short/copy";
import { notify } from "@/lib/toast";
import { Button, Card, Chips, Field, Row, Rows } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { Note } from "./PageParts";
import type { ReviewRequest } from "./ReviewSheet";

/** web's `FILL_FLOOR_BPS`: the open accepts up to 5% fewer contracts than quoted, as the Ticket's boost does. */
const FILL_FLOOR_BPS = 9_500n;
const T = SHORT.ticket;

interface SizerProps {
  market: EventMarket;
  reserve: LeverageReserveState;
  symbol: string;
  walletBase: bigint | null;
  multiples: number[];
  multiple: number;
  onMultiple: (x: number) => void;
  amount: string;
  onAmount: (text: string) => void;
  onReview: (request: ReviewRequest) => void;
}

/**
 * web's `Sizer` in `ShortTicket.tsx`: stake, multiple, and what the reserve would actually open — every figure from
 * `sizeLeverageForStake`, the same walk the program runs. The review freezes the quote on screen, and the open is
 * sent from exactly that quote with its 5% fill floor.
 */
export function ShortSizer({ market, reserve, symbol, walletBase, multiples, multiple, onMultiple, amount, onAmount, onReview }: SizerProps) {
  const { color } = useTheme();
  const { decimals, params, paused } = reserve;
  const writes = useLeverageWrites();
  const stakeBase = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
  const leverageBps = leverageBpsOf(multiple);
  const quoteState = useLeverageQuote({ market, side: "down", stakeBase, leverageBps, params, enabled: writes.canSign && !paused && stakeBase > 0n });
  const { quote } = quoteState;
  const wallet = walletBase ?? 0n;
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const two = (base: bigint, group = true) => formatBaseUnits(base, decimals, { minDp: 2, maxDp: 2, group });

  const thin = quoteState.error?.kind === "thin-book" ? thinBook(quoteState.error.technical, stakeBase) : null;
  const note = paused
    ? T.paused
    : stakeBase <= 0n
      ? T.enterAmount
      : thin
        ? thin.maxBase === null
          ? T.thinExit
          : thin.maxBase <= 0n
            ? T.thinNone
            : T.thinSome(two(thin.maxBase), symbol)
        : quoteState.error
          ? diagnosisCopy(quoteState.error.kind).headline
          : quote
            ? quote.stakeBase < stakeBase
              ? T.sized(money(quote.stakeBase), symbol)
              : null
            : quoteState.loading
              ? T.pricing
              : null;

  const send = async (frozen: LeverageQuote): Promise<boolean> => {
    const outcome = await writes.open({
      marketId: market.marketId,
      side: "down",
      stakeBase,
      leverageBps,
      minQuantityRaw: (frozen.quantityRaw * FILL_FLOOR_BPS) / 10_000n,
    });
    if (!outcome) return false;
    if (outcome.status === "confirmed") {
      onAmount("");
      notify.neutral(T.opened(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 }), market.asset));
      return true;
    }
    if (outcome.status === "requote") {
      notify.warning(diagnosisCopy("requote").headline, T.requote(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 })));
      quoteState.retry();
      return false;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    notify.warning(copy.headline, outcome.diagnosis.technical || copy.body);
    return false;
  };

  const review = () => {
    if (!quote) return;
    const frozen = quote;
    const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0, maxDp: 2 });
    onReview({
      title: `Short ${market.asset} ${formatCadence(market.intervalSec)} · Down ${multiple}×`,
      lines: [
        { label: T.cells.contracts, value: contracts(frozen.quantityRaw), hint: `At least ${contracts((frozen.quantityRaw * FILL_FLOOR_BPS) / 10_000n)} or it is refused` },
        { label: T.cells.entry, value: `${bpsToOddsCents(priceRawToBps(frozen.priceRaw, decimals))}¢` },
        { label: "Your stake", value: `${money(frozen.stakeBase)} ${symbol}` },
        { label: "Reserve fronts", value: `${money(frozen.frontedBase)} ${symbol}` },
        { label: "Premium (inside your stake)", value: `${money(frozen.premiumBase)} ${symbol}` },
        { label: "Knock-out line", value: `${money(frozen.lineBase)} ${symbol}`, tone: "muted" },
        { label: T.cells.back, value: `${money(frozen.winIfRightBase)} ${symbol}`, tone: "profit" },
      ],
      maxLoss: `${money(frozen.stakeBase)} ${symbol}`,
      confirmLabel: `Slide to short ${market.asset}`,
      tone: "loss",
      send: () => send(frozen),
    });
  };

  return (
    <Card>
      <Field
        label={T.amount}
        value={amount}
        onChangeText={(text) => onAmount(text.replace(/[^0-9.]/g, ""))}
        placeholder="0.00"
        numeric
        suffix={symbol}
      />
      <View style={styles.walletRow}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{walletBase === null ? T.walletPending : T.wallet(two(wallet), symbol)}</Text>
        <Button label={T.max} variant="ghost" size="sm" block={false} disabled={walletBase === null} onPress={() => onAmount(two(wallet, false))} />
      </View>

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{T.multiple}</Text>
      <Chips options={multiples.map((x) => ({ value: x, label: `${x}×` }))} value={multiple} onPick={onMultiple} />
      <Note text={T.multipleHint(percentOf(params.premiumBps))} />

      <Rows>
        <Row label={T.cells.contracts} value={quote ? formatBaseUnits(quote.quantityRaw, decimals, { minDp: 0, maxDp: 2 }) : "—"} />
        <Row label={T.cells.entry} value={quote ? `${bpsToOddsCents(priceRawToBps(quote.priceRaw, decimals))}¢` : "—"} />
        <Row label={T.cells.back} value={quote ? `${money(quote.winIfRightBase)} ${symbol}` : "—"} tone={quote ? "profit" : undefined} />
      </Rows>
      {note ? <Note text={note} warn={quoteState.error !== null || thin !== null} /> : null}
      {thin && thin.maxBase !== null && thin.maxBase > 0n ? (
        <Button label={T.useMax(two(thin.maxBase), symbol)} variant="outline" size="sm" onPress={() => onAmount(two(thin.maxBase as bigint, false))} />
      ) : null}

      <Button
        label={writes.busy === "open" ? T.busy : quote ? `${T.cta(market.asset, multiple)} ${money(quote.stakeBase)} ${symbol}` : T.ctaPlain}
        variant="loss"
        size="lg"
        loading={writes.busy === "open"}
        disabled={!quote || paused}
        onPress={review}
      />
      {quote ? <Note text={T.knockNote(money(quote.lineBase), symbol)} /> : null}
    </Card>
  );
}

/** web's `thinBook`: the stake that fits a thin book is the offered share of it, less 5% for the book moving. */
function thinBook(technical: string, stakeBase: bigint): { maxBase: bigint | null } {
  const m = /^(\d+) of the (\d+) this stake buys is on offer/.exec(technical);
  if (!m) return { maxBase: null };
  const filled = BigInt(m[1] as string);
  const wanted = BigInt(m[2] as string);
  if (filled <= 0n || wanted <= 0n) return { maxBase: 0n };
  return { maxBase: (stakeBase * filled * 95n) / (wanted * 100n) };
}

/** A bps parameter as the percentage the copy names: 800 → "8%". */
export function percentOf(bps: number): string {
  return `${Math.round(bps / 10) / 10}%`;
}

const styles = StyleSheet.create({
  walletRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: -4 },
});
