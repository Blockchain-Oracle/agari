import type { PrintProof } from "@agari/markets";
import { StyleSheet, Text, View } from "react-native";
import { isPreStocksAsset, printSourceName } from "@/features/markets/price-source/source-label";
import { PROOF } from "@/features/proof/copy";
import { crossCheckBpsText, crossCheckPair, replayDiff } from "@/features/proof/format";
import { FONT, useTheme } from "~/theme";
import { statusTokens } from "~/theme/web/explore/status";
import { StatusTable } from "./Frame";
import { oraclePriceText } from "./price";

type Tone = "good" | "warn" | "bad" | "off";

function rowOf(print: PrintProof): { tone: Tone; detail: string } {
  if (print.source === "pyth") {
    const replay = print.replay;
    const state = replay?.state ?? "none";
    // A stored decode that does not equal the print is never shown as proven (the replay refuses one; old rows may not).
    const diff = replay?.price != null && replay.expo != null ? replayDiff(replay.price, replay.expo, print.priceE8) : 0n;
    if ((state === "verified" || state === "closed") && diff !== 0n) return { tone: "bad", detail: PROOF.differs(diff.toString()) };
    return { tone: PROOF.tones[state], detail: PROOF.state[state] };
  }
  if (print.source === "redstone") {
    return { tone: print.archive ? "good" : "off", detail: `${PROOF.signerCount(print.signers)} · ${print.archive ? PROOF.redstoneVerified : PROOF.noArchive}` };
  }
  if (print.source === "attested") return isPreStocksAsset(print.symbol) ? { tone: "good", detail: PROOF.attestedPreStocks } : { tone: "off", detail: PROOF.attested };
  return { tone: print.archive ? "good" : "off", detail: PROOF.switchboard };
}

/** `.status-row` at phone width: dot, label, the mono figure, then the detail wrapped under the label. */
function StatusRow({ tone, label, lag, detail, first }: { tone: Tone; label: string; lag: string; detail: string; first: boolean }) {
  const { name, color } = useTheme();
  const t = statusTokens(name);
  const dot = { good: color.profit, warn: t.amber, bad: color.loss, off: color.inkDisabled }[tone];
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: t.rule }]} accessible accessibilityLabel={`${label}: ${lag}. ${detail}`}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color: color.ink }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.lag, { color: color.inkMuted }]}>{lag}</Text>
      <Text style={[styles.detail, { color: color.inkDisabled }]} numberOfLines={1}>
        {detail}
      </Text>
    </View>
  );
}

/** web's ProofTable.tsx: the Window's prints at a glance in the status table's rows, then the cross-check. */
export function ProofTable({ prints, singleSource }: { prints: readonly PrintProof[]; singleSource: boolean }) {
  const pair = crossCheckPair(prints);
  const bps = pair ? crossCheckBpsText(pair.primary.priceE8, pair.check.priceE8) : null;
  return (
    <StatusTable title={PROOF.tableTitle(prints.length)}>
      {prints.map((print, i) => {
        const { tone, detail } = rowOf(print);
        return (
          <StatusRow
            key={`${print.which}:${print.recordSignature}`}
            first={i === 0}
            tone={tone}
            label={`${PROOF.which[print.which]} · ${print.source ? printSourceName(print.source, print.symbol) : PROOF.unknownSource}`}
            lag={oraclePriceText(print.priceE8, print.symbol ?? "")}
            detail={detail}
          />
        );
      })}
      <StatusRow
        first={false}
        tone={bps !== null ? "good" : "off"}
        label={PROOF.crossCheck}
        lag={bps !== null ? `${bps} bps` : "—"}
        detail={bps !== null ? PROOF.crossCheckBps(bps) : singleSource ? PROOF.singleSource : PROOF.noCheck}
      />
    </StatusTable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, paddingVertical: 12, paddingHorizontal: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, minWidth: 0, fontFamily: FONT.bodyMedium, fontSize: 12, lineHeight: 19.2 },
  lag: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"] },
  detail: { flexBasis: "100%", paddingLeft: 20, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
