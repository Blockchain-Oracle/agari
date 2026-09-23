import type { PrintProof } from "@agari/markets";
import { StyleSheet, Text, View } from "react-native";
import { isPreStocksAsset, printSourceName } from "@/features/markets/price-source/source-label";
import { PROOF } from "@/features/proof/copy";
import { crossCheckBpsText, crossCheckPair, replayDiff } from "@/features/proof/format";
import { FONT, RADIUS, TYPE, useTheme, type Palette } from "~/theme";
import { oraclePriceText } from "~/features/surface/parts";

type Tone = "good" | "warn" | "bad" | "off";

/** web's `rowOf` (ProofTable.tsx): each print's state as a tone and a line. */
function rowOf(print: PrintProof): { tone: Tone; detail: string } {
  if (print.source === "pyth") {
    const replay = print.replay;
    const state = replay?.state ?? "none";
    // A stored decode that does not equal the print is never shown as proven.
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

const toneInk = (tone: Tone, color: Palette) => ({ good: color.profit, warn: color.warning, bad: color.loss, off: color.inkMuted })[tone];

function StatusRow({ tone, label, figure, detail }: { tone: Tone; label: string; figure: string; detail: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.row, { borderTopColor: color.hairline }]} accessible accessibilityLabel={`${label}: ${figure}. ${detail}`}>
      <View style={[styles.dot, { backgroundColor: toneInk(tone, color) }]} />
      <View style={styles.text}>
        <View style={styles.head}>
          <Text style={[TYPE.bodyStrong, styles.label, { color: color.ink }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[TYPE.data, { color: color.ink }]}>{figure}</Text>
        </View>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{detail}</Text>
      </View>
    </View>
  );
}

/** web's `ProofTable`: the Window's prints at a glance, one dot per print, then the cross-check between sources. */
export function ProofTable({ prints, singleSource }: { prints: readonly PrintProof[]; singleSource: boolean }) {
  const { color } = useTheme();
  const pair = crossCheckPair(prints);
  const bps = pair ? crossCheckBpsText(pair.primary.priceE8, pair.check.priceE8) : null;
  return (
    <View style={[styles.table, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[styles.title, { color: color.inkMuted }]}>{PROOF.tableTitle(prints.length).toUpperCase()}</Text>
      {prints.map((print) => {
        const { tone, detail } = rowOf(print);
        const source = print.source ? printSourceName(print.source, print.symbol) : PROOF.unknownSource;
        return (
          <StatusRow
            key={`${print.which}:${print.recordSignature}`}
            tone={tone}
            label={`${PROOF.which[print.which]} · ${source}`}
            figure={oraclePriceText(print.priceE8, print.symbol ?? "")}
            detail={detail}
          />
        );
      })}
      <StatusRow
        tone={bps !== null ? "good" : "off"}
        label={PROOF.crossCheck}
        figure={bps !== null ? `${bps} bps` : "—"}
        detail={bps !== null ? PROOF.crossCheckBps(bps) : singleSource ? PROOF.singleSource : PROOF.noCheck}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 12 },
  title: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.4, paddingBottom: 10 },
  row: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  text: { flex: 1, gap: 2 },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  label: { flexShrink: 1 },
});
