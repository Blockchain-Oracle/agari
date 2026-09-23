import { nameOf } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { parseDecimalToBaseUnits } from "@agari/core/units";
import { DESK_MINTS, USDC_MAINNET } from "@agari/markets/desk";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MONEY } from "@/features/desk/copy-controls";
import { tokens, usd } from "@/features/desk/format";
import { MIN_DEPOSIT_E6, TRANSFER_FEE_BPS } from "@/features/desk/protocol";
import { useOwnerBalances } from "@/features/desk/useDesk";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Chips, Field, LoadingState, Segmented, type QuoteLine } from "~/components/kit";
import { pushToast } from "~/components/toast/store";
import { TYPE, useTheme } from "~/theme";
import { mainnetBlocker } from "./blocker";
import { said } from "./review-lines";
import { ReviewSheet } from "./ReviewSheet";

/** Raw 9 dp × the ScaledUiAmount multiplier (E12) → UI tokens at 9 dp, for the receipt's figures. */
const uiRaw = (raw: bigint, multiplierE12: bigint | null): bigint => (multiplierE12 === null ? raw : (raw * multiplierE12) / 10n ** 12n);
const netOfFee = (raw: bigint): bigint => (raw * BigInt(10_000 - TRANSFER_FEE_BPS)) / 10_000n;
const R = MONEY.receipt;

interface Props {
  view: DeskView;
  actions: DeskActions;
  kind: "deposit" | "withdraw";
  zone: string | null;
  nowSec: number;
  onClose: () => void;
}

/**
 * Money in, money out (web's MoneySheet.tsx): USDC from this wallet or PreStocks tokens already held, PreStocks' 1%
 * transfer fee shown before confirming; withdrawals go to the owner's own wallet only. Balances are read on Solana
 * mainnet; the review names every figure and the most it can cost.
 */
export function MoneySheet({ view, actions, kind, onClose }: Props) {
  const { color } = useTheme();
  const symbols = view.mandate?.targets.tokens.map((t) => t.symbol) ?? [];
  const balances = useOwnerBalances(actions.owner, symbols, true);
  const [way, setWay] = useState<"usdc" | "tokens">("usdc");
  const [amount, setAmount] = useState("");
  const [symbol, setSymbol] = useState<PreIpoSymbol | null>(symbols[0] ?? null);
  const [everything, setEverything] = useState(kind === "deposit");
  const [asCash, setAsCash] = useState(false);
  const { state } = actions;
  const sheet = { visible: true, onClose, phase: state.phase, problem: state.problem, signature: state.signature, eyebrow: MONEY.eyebrow };
  const blocker = mainnetBlocker(actions);

  if (balances === null || !balances.ok) {
    const line = balances === null ? MONEY.reading : MONEY.unreadable;
    return (
      <ReviewSheet {...sheet} title={kind === "deposit" ? MONEY.sheetTitle : MONEY.withdraw.title} body={MONEY.intro} review={{ title: line, lines: [], maxLoss: "—", confirmLabel: MONEY.send, blocker: line }} onConfirm={() => undefined}>
        {balances === null ? <LoadingState shape="row" /> : null}
      </ReviewSheet>
    );
  }
  const b = balances.value;
  const held = b.names.filter((n) => n.raw > 0n);
  const name = held.find((n) => n.symbol === symbol) ?? held[0] ?? null;
  const noSol = b.lamports === 0n ? MONEY.noSol.line : null;

  if (kind === "deposit") {
    const usdcE6 = parseDecimalToBaseUnits(amount, 6);
    const tooSmall = usdcE6 !== null && usdcE6 < MIN_DEPOSIT_E6 ? MONEY.tooSmall(usd(MIN_DEPOSIT_E6, 0)) : null;
    const tokenRaw = name ? (everything ? name.raw : (parseDecimalToBaseUnits(amount, 9) ?? 0n)) : 0n;
    const usdcProblem = usdcE6 === null || usdcE6 <= 0n ? MONEY.usdc.amount : tooSmall ?? (usdcE6 > b.usdc.raw ? MONEY.usdc.have(usd(b.usdc.raw)) : null);
    const tokenProblem = name === null ? MONEY.tokens.none : tokenRaw <= 0n || tokenRaw > name.raw ? MONEY.tokens.title : null;
    const lines: QuoteLine[] =
      way === "usdc"
        ? usdcE6 !== null && usdcE6 > 0n
          ? [{ label: R.send, value: `${usd(usdcE6)} USDC` }, { label: R.receive, value: `${usd(usdcE6)} USDC` }, { label: R.networkFee, value: R.networkFeeValue }, { label: R.takes, value: R.seconds }]
          : []
        : name && tokenRaw > 0n
          ? [
              { label: R.send, value: R.leaves(tokens(uiRaw(tokenRaw, name.multiplierE12)), name.symbol) },
              { label: R.fee, value: `${tokens(uiRaw(tokenRaw - netOfFee(tokenRaw), name.multiplierE12))} ${name.symbol}` },
              { label: R.receive, value: R.arrives(tokens(uiRaw(netOfFee(tokenRaw), name.multiplierE12)), name.symbol) },
              { label: R.networkFee, value: R.networkFeeValue },
            ]
          : [];
    const confirm = async () => {
      if (way === "usdc" && usdcE6 !== null) {
        const landed = await actions.tx("deposit", (s) => s.deposit({ mint: USDC_MAINNET, ownerToken: b.usdc.ownerToken, amount: usdcE6 }));
        if (landed.ok) pushToast({ tone: "neutral", title: MONEY.deposited(usd(usdcE6), "USDC") });
      } else if (way === "tokens" && name) {
        const landed = await actions.tx("deposit", (s) => s.deposit({ mint: DESK_MINTS[name.symbol], ownerToken: name.ownerToken, amount: tokenRaw }));
        if (landed.ok) pushToast({ tone: "neutral", title: MONEY.deposited(tokens(uiRaw(netOfFee(tokenRaw), name.multiplierE12)), name.symbol) });
      }
    };
    const maxLoss = way === "usdc" ? (usdcE6 ? `${usd(usdcE6)} USDC` : "—") : name ? `${tokens(uiRaw(tokenRaw, name.multiplierE12))} ${name.symbol}` : "—";
    return (
      <ReviewSheet
        {...sheet}
        title={MONEY.sheetTitle}
        body={MONEY.intro}
        review={{ title: MONEY.sheetTitle, lines, maxLoss, confirmLabel: MONEY.send, blocker: blocker ?? noSol ?? (way === "usdc" ? usdcProblem : tokenProblem), tone: "accent" }}
        onConfirm={() => void confirm()}
      >
        <Segmented label={MONEY.sheetTitle} value={way} onChange={setWay} options={[{ value: "usdc", label: "USDC" }, { value: "tokens", label: "PreStocks tokens" }]} />
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {way === "usdc"
            ? b.usdc.raw > 0n
              ? MONEY.usdc.have(usd(b.usdc.raw))
              : MONEY.usdc.none
            : held.length === 0
              ? MONEY.tokens.none
              : held.map((n) => MONEY.tokens.row(tokens(uiRaw(n.raw, n.multiplierE12)), nameOf(n.symbol))).join(" · ")}
        </Text>
        {way === "usdc" ? <Field label={MONEY.usdc.amount} value={amount} onChangeText={setAmount} numeric placeholder="300" suffix="USDC" error={tooSmall} /> : null}
        {way === "tokens" && name ? (
          <>
            <Chips options={held.map((n) => ({ value: n.symbol, label: nameOf(n.symbol) }))} value={name.symbol} onPick={setSymbol} />
            <Chips options={[{ value: "all", label: MONEY.tokens.all }, { value: "some", label: MONEY.withdraw.some }]} value={everything ? "all" : "some"} onPick={(v) => setEverything(v === "all")} />
            {!everything ? <Field label={MONEY.tokens.title} value={amount} onChangeText={setAmount} numeric suffix={name.symbol} /> : null}
          </>
        ) : null}
      </ReviewSheet>
    );
  }

  const cashE6 = view.wire.chain ? BigInt(view.wire.chain.usdcRaw) : 0n;
  const heldInDesk = (view.wire.chain?.tokens ?? []).filter((t) => t.symbol && BigInt(t.raw) > 0n);
  const someE6 = parseDecimalToBaseUnits(amount, 6);
  const usdcOk = everything ? cashE6 > 0n : someE6 !== null && someE6 > 0n && someE6 <= cashE6;
  const ready = asCash || usdcOk || (everything && heldInDesk.length > 0);
  const confirmWithdraw = async () => {
    if (asCash) {
      const requested = await actions.requestAction("sell_all");
      if (requested.ok) pushToast({ tone: "neutral", title: MONEY.withdraw.cashNote });
      return;
    }
    if (usdcOk) {
      const landed = await actions.tx("withdraw", (s) => s.withdraw({ mint: USDC_MAINNET, ...(everything ? {} : { amount: someE6 as bigint }) }));
      if (landed.ok) pushToast({ tone: "neutral", title: MONEY.withdrawn("USDC") });
    }
    if (everything) {
      for (const t of heldInDesk) {
        const landed = await actions.tx("withdraw", (s) => s.withdraw({ mint: DESK_MINTS[t.symbol as PreIpoSymbol] }));
        if (!landed.ok) break;
        pushToast({ tone: "neutral", title: MONEY.withdrawn(t.symbol as string) });
      }
    }
  };
  const after = asCash ? MONEY.withdraw.asCash : everything ? MONEY.withdraw.perMint(1 + heldInDesk.length) : `${usd(someE6 ?? 0n)} USDC`;
  return (
    <ReviewSheet
      {...sheet}
      title={MONEY.withdraw.title}
      body={MONEY.withdraw.body}
      review={{
        title: MONEY.withdraw.title,
        lines: [said(MONEY.withdraw.to, "Your wallet", actions.owner ?? "—"), { label: "In the desk", value: `${usd(cashE6)} USDC` }, said("After", "", after), { label: R.networkFee, value: R.networkFeeValue }],
        maxLoss: asCash ? "1% of each sale" : "$0.00",
        confirmLabel: MONEY.withdraw.button,
        blocker: (asCash ? null : blocker) ?? (ready ? null : MONEY.withdraw.amount),
      }}
      onConfirm={() => void confirmWithdraw()}
    >
      <Chips options={[{ value: "some", label: MONEY.withdraw.some }, { value: "all", label: MONEY.withdraw.all }]} value={everything ? "all" : "some"} onPick={(v) => setEverything(v === "all")} />
      {!everything ? <Field label={MONEY.withdraw.amount} value={amount} onChangeText={setAmount} numeric placeholder="100" suffix="USDC" /> : null}
      {heldInDesk.length > 0 ? (
        <View style={styles.choices}>
          <Chips options={[{ value: "tokens", label: MONEY.withdraw.asTokens }, { value: "cash", label: MONEY.withdraw.asCash }]} value={asCash ? "cash" : "tokens"} onPick={(v) => setAsCash(v === "cash")} />
          {asCash ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{MONEY.withdraw.cashNote}</Text> : null}
        </View>
      ) : null}
    </ReviewSheet>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 8 },
});
