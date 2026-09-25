import type { Address } from "@agari/core/types";
import { formatBaseUnits, formatUtc, shortHex } from "@agari/core/units";
import { Children, createContext, useContext, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SESSION } from "@/features/session/copy";
import { SOL_DECIMALS } from "@/features/session/fees";
import { FONT } from "~/theme";
import { tkType, useTk } from "../tk";
import { useSessionTokens } from "./ModalShell";

const Stacked = createContext(false);

/**
 * SessionDetails.module.css `.details` / `.row`: label and value side by side (a 96 px label column), hairlines between
 * rows; under 300 px of width (`@container session-details`) the label sits over the value.
 */
export function DetailList({ stacked = false, children }: { stacked?: boolean; children: ReactNode }) {
  const { color } = useSessionTokens();
  const rows = Children.toArray(children);
  return (
    <Stacked.Provider value={stacked}>
      {rows.map((row, i) => (
        <View key={i} style={[stacked ? styles.stacked : styles.row, i > 0 && [styles.ruled, { borderTopColor: color.hairline }], i === 0 && styles.first, i === rows.length - 1 && styles.last]}>
          {row}
        </View>
      ))}
    </Stacked.Provider>
  );
}

/** web's SessionDetail: the `dt` label and the `dd` value, one row of a DetailList. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  const { color } = useSessionTokens();
  const stacked = useContext(Stacked);
  return (
    <>
      <Text style={[styles.label, !stacked && styles.labelCol, { color: color.inkSecondary }]}>{label}</Text>
      <View style={!stacked && styles.valueCol}>{typeof children === "string" || typeof children === "number" ? <Text style={[styles.value, { color: color.ink }]}>{children}</Text> : children}</View>
    </>
  );
}

/** `.money`: the amount in the data face, the unit after it in the body face, secondary. */
export function Money({ base, decimals, symbol, large = false }: { base: bigint; decimals: number; symbol: string; large?: boolean }) {
  const { color } = useSessionTokens();
  return (
    <Text style={[styles.money, large && styles.moneyLarge, { color: color.ink }]}>
      {formatBaseUnits(base, decimals)} <Text style={[styles.unit, { color: color.inkSecondary }]}>{symbol}</Text>
    </Text>
  );
}

/** web's Hash / UtcTime, the tabular value faces. */
export function Numbers({ text, strong = false }: { text: string; strong?: boolean }) {
  const { color } = useSessionTokens();
  return <Text style={[styles.value, styles.numbers, strong && styles.strong, { color: color.ink }]}>{text}</Text>;
}
export const hashText = (value: string) => shortHex(value, 8, 6);
export const utcText = (ms: number, withDate = false) => formatUtc(ms, { withSeconds: false, withDate });

/**
 * web's CapabilityReceipt (UX-DR7): what the signature grants, what it can never do, the key, when it expires, who pays
 * and how many signatures — on surface-2 in a 12 px-radius hairline box.
 */
export function CapabilityReceipt({ keyAddress, expiresAtSec, sponsorConfigured, topUpLamports }: { keyAddress: Address | null; expiresAtSec: number; sponsorConfigured: boolean; topUpLamports: bigint }) {
  const { color } = useSessionTokens();
  const tk = useTk();
  const r = SESSION.sheet.receipt;
  const gasText = sponsorConfigured ? r.gasSponsor : r.gasKey(formatBaseUnits(topUpLamports, SOL_DECIMALS, { maxDp: 3, minDp: 0 }));
  return (
    <View style={[styles.box, { borderColor: color.hairline, backgroundColor: color.surface2 }]}>
      <Text style={[tkType.label, { color: tk.label }]}>{SESSION.sheet.receiptTitle}</Text>
      <DetailList stacked>
        <Detail label={r.scope}>{r.scopeValue}</Detail>
        <Detail label={r.cannot}>{r.cannotValue}</Detail>
        <Detail label={r.key}>{keyAddress ? <Numbers text={hashText(keyAddress)} /> : "—"}</Detail>
        <Detail label={r.expiresAt}>
          <Numbers text={utcText(expiresAtSec * 1000, true)} />
        </Detail>
        <Detail label={r.gas}>{gasText}</Detail>
        <Detail label={r.signatures}>{sponsorConfigured ? r.sigsOne : r.sigsWithTopUp}</Detail>
      </DetailList>
    </View>
  );
}

export const sessionStyles = StyleSheet.create({
  box: { gap: 16, padding: 16, borderWidth: 1, borderRadius: 12 },
  label: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  value: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  heading: { marginBottom: 12, fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 21 },
  note: { marginTop: 4, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
});

const styles = StyleSheet.create({
  ...sessionStyles,
  row: { flexDirection: "row", alignItems: "baseline", columnGap: 16, paddingVertical: 12 },
  stacked: { gap: 6, paddingVertical: 12 },
  ruled: { borderTopWidth: 1 },
  first: { paddingTop: 0 },
  last: { paddingBottom: 0 },
  labelCol: { width: 96 },
  valueCol: { flex: 1, minWidth: 0 },
  // `.money` is `var(--font-data)`, which production resolves to the body face (Inter), tabular.
  money: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4, fontVariant: ["tabular-nums"] },
  moneyLarge: { fontFamily: FONT.bodyStrong, fontSize: 16, lineHeight: 25.6 },
  unit: { fontFamily: FONT.body, fontSize: 12 },
  numbers: { fontVariant: ["tabular-nums"] },
  strong: { fontFamily: FONT.bodyStrong, fontSize: 16, lineHeight: 25.6 },
});
