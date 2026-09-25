import { SUBMITTED_UNKNOWN } from "@agari/core/copy";
import { ownCentsOf } from "@agari/core/orders";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import type { PlaceBetState } from "@/features/markets/ticket/usePlaceBet";
import { PREOPEN, TICKET } from "@/lib/copy";
import { ErrorState } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { useTk } from "./tk";

/** web's Hash with an href: the short signature, dotted-underlined, opening the explorer. */
export function TxHash({ hash, color }: { hash: string; color: string }) {
  return (
    <Text onPress={() => void openExternal(explorerUrl("tx", hash))} accessibilityRole="link" style={[styles.hash, { color, textDecorationColor: color }]}>
      {shortHex(hash)}
    </Text>
  );
}

function Line({ children, txHash }: { children: ReactNode; txHash?: string | null }) {
  const tk = useTk();
  return (
    <View style={[styles.line, { borderColor: tk.hairline, backgroundColor: tk.noteBg }]} accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: tk.ink }]}>{children}</Text>
      {txHash ? (
        <Text style={[styles.text, { color: tk.inkSecondary }]}>
          {TICKET.txLabel} <TxHash hash={txHash} color={tk.ink} />
        </Text>
      ) : null}
    </View>
  );
}

/** web's OutcomeNote: what the chain said about the last send, from the receipt and the fills — never a revert shown as success. */
export function OutcomeNote({ state, decimals, symbol, onDismiss }: { state: PlaceBetState; decimals: number; symbol: string; onDismiss: () => void }) {
  const { outcome, txHash } = state;
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0 });
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  if (state.phase === "unknown") return <Line txHash={txHash}>{SUBMITTED_UNKNOWN}</Line>;
  if (!outcome) return null;
  switch (outcome.status) {
    case "confirmed": {
      const { booked } = outcome;
      return (
        <Line txHash={booked.txHash}>
          {TICKET.bookedPrefix} {contracts(booked.contractsRaw)} {SIDE_WORD[booked.side]} {TICKET.bookedAt} {Math.round(booked.avgPriceBps / 100)}¢ · {money(booked.costBase)}
        </Line>
      );
    }
    case "resting":
      return <Line txHash={outcome.rested.txHash}>{PREOPEN.ticket.resting(contracts(outcome.rested.contractsRaw), SIDE_WORD[outcome.rested.side], ownCentsOf(outcome.rested.side, outcome.rested.priceTicks))}</Line>;
    case "nothingFilled":
      return <Line txHash={outcome.txHash}>{TICKET.nothingFilled}</Line>;
    case "requote":
      return (
        <Line>
          {TICKET.requotePrefix} {money(outcome.quote.maxCostBase)} {TICKET.requoteSuffix}
        </Line>
      );
    case "reverted":
    case "refused":
      return <ErrorState diagnosis={outcome.diagnosis} retry={onDismiss} />;
    case "unknown":
      return <Line txHash={outcome.txHash ?? null}>{SUBMITTED_UNKNOWN}</Line>;
  }
}

/** web's REGION_NOTE (region/RegionNote.tsx, a DOM file, so restated): the line under a control held in this region. */
const REGION_NOTE = { line: "Funded actions are closed in your region. Reading stays open.", link: "How it works" } as const;

/** web's RegionNote: what the visitor can still do, and where to read why; the held control's label is the blocker. */
export function RegionNote() {
  const tk = useTk();
  return (
    <Text style={[styles.text, { color: tk.inkSecondary }]}>
      {REGION_NOTE.line}{" "}
      <Text style={[styles.underline, { color: tk.ink }]} accessibilityRole="link" onPress={() => router.push("/how-it-works")}>
        {REGION_NOTE.link}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  text: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  underline: { textDecorationLine: "underline" },
  hash: { fontFamily: FONT.dataRegular, textDecorationLine: "underline", textDecorationStyle: "dotted" },
});
