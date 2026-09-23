import type { Signature } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { StyleSheet, Text, View } from "react-native";
import type { SolveMode } from "@/features/range/RangeTicket";
import { Button, Card, Field, Segmented } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { FONT, TYPE, useTheme } from "~/theme";

/** web's parlay `TicketParts` step ladder, as the reserve tickets use it. */
export type PlaceStep = "idle" | "placing" | "success" | "error";

/** A decimal typed into a money field: digits and one point. */
export function sanitizeAmount(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

interface SolverProps {
  labels: { setStake: string; setPayout: string; youPay: string; youWin: string; ifLands: string };
  solveMode: SolveMode;
  onSolveMode: (mode: SolveMode) => void;
  stakeInput: string;
  onStakeInput: (v: string) => void;
  payoutInput: string;
  onPayoutInput: (v: string) => void;
  symbol: string;
  walletHint?: string;
}

/** web's ticket solver (`pl-solver`): set the stake and read the payout, or set the payout and read the stake. */
export function Solver({ labels, solveMode, onSolveMode, stakeInput, onStakeInput, payoutInput, onPayoutInput, symbol, walletHint }: SolverProps) {
  const { color } = useTheme();
  return (
    <View style={styles.solver}>
      <Segmented
        label="Solve for"
        value={solveMode}
        onChange={onSolveMode}
        options={[
          { value: "fixStake", label: labels.setStake },
          { value: "fixPayout", label: labels.setPayout },
        ]}
      />
      {solveMode === "fixStake" ? (
        <Field label={labels.youPay} value={stakeInput} onChangeText={(t) => onStakeInput(sanitizeAmount(t))} placeholder="0.00" numeric suffix={symbol} />
      ) : (
        <Field label={labels.youWin} value={payoutInput} onChangeText={(t) => onPayoutInput(sanitizeAmount(t))} placeholder="0.00" numeric suffix={symbol} />
      )}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{solveMode === "fixStake" ? walletHint : labels.ifLands}</Text>
    </View>
  );
}

/** The ticket's headline: the contract's multiple and the odds line under it. */
export function Pays({ label, multiple, sub, loading }: { label: string; multiple: string | null; sub: string | null; loading: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.pays} accessibilityLiveRegion="polite">
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.multiple, { color: loading || multiple === null ? color.inkMuted : color.accent }]}>{loading ? "···" : (multiple ?? "···")}</Text>
      {sub && !loading ? <Text style={[TYPE.caption, { color: color.inkSecondary, textAlign: "center" }]}>{sub}</Text> : null}
    </View>
  );
}

/** web's `ErrorBlock`: the diagnosis headline, its technical line, and a way back. */
export function PlaceError({ title, detail, onReset, tryAgain, txHash }: { title: string; detail: string; onReset: () => void; tryAgain: string; txHash: Signature | null }) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: color.lossWash }]}>
      <Text style={[TYPE.bodyStrong, { color: color.loss }]}>{title}</Text>
      {detail ? (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]} selectable>
          {detail}
        </Text>
      ) : null}
      {txHash ? <Button label={`Transaction ${shortHex(txHash, 6, 4)}`} variant="ghost" size="sm" onPress={() => void openExternal(txUrl(txHash))} /> : null}
      <Button label={tryAgain} variant="secondary" size="sm" onPress={onReset} />
    </View>
  );
}

/** web's `RangePlaced`: the receipt line, the transaction, and "another" — on the cream receipt paper. */
export function Placed({ title, line, txHash, viewTx, another, onAnother }: { title: string; line: string; txHash: Signature | null; viewTx: string; another: string; onAnother: () => void }) {
  const { color } = useTheme();
  return (
    <Card tone="cream">
      <Text style={[TYPE.stamp, { color: color.creamInk }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[TYPE.body, { color: color.creamInk }]}>{line}</Text>
      {txHash ? <Button label={viewTx} variant="secondary" size="sm" icon={{ ios: "arrow.up.right.square", android: "open_in_new" }} onPress={() => void openExternal(txUrl(txHash))} /> : null}
      <Button label={another} size="sm" onPress={onAnother} />
    </Card>
  );
}

const styles = StyleSheet.create({
  solver: { gap: 10 },
  pays: { alignItems: "center", gap: 2, paddingVertical: 6 },
  multiple: { fontFamily: FONT.dataStrong, fontSize: 44, lineHeight: 50, fontVariant: ["tabular-nums"] },
  error: { borderRadius: 12, padding: 14, gap: 8 },
});
