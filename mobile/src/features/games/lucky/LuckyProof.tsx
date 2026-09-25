import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyDealWire } from "@/features/games/lucky/lucky-wire";
import { useLuckyCheck } from "@/features/games/lucky/useLuckyCheck";
import { PulseDot } from "~/features/games/frame";
import { FONT } from "~/theme";
import { Band, LUCKY_TEXT, SectionK, useLuckyTokens } from "./parts";

/**
 * web's `LuckyDeal.tsx` Proof band (`.st-band.lk-section`): the commitment and both seeds in a key/value grid, the
 * nonce and candidate count, the check replayed on this phone with its dot (pulsing while it runs, profit once
 * verified, loss on a mismatch), and the line that says exactly what the proof proves.
 */
export function LuckyProof({ deal }: { deal: LuckyDealWire }) {
  const { color } = useLuckyTokens();
  const check = useLuckyCheck(deal);
  const words = LUCKY.deal.proof;
  const line = check === "checking" ? words.checking : check === "verified" ? words.verified : check === "mismatch" ? words.mismatch : words.unavailable;
  const ink = check === "verified" ? color.profit : check === "mismatch" || check === "unavailable" ? color.loss : color.inkSecondary;
  const dot = check === "verified" ? color.profit : check === "mismatch" ? color.loss : check === "checking" ? color.accent : color.inkDisabled;

  return (
    <Band>
      <SectionK>{words.label}</SectionK>
      <View style={styles.kv}>
        {[
          [words.commitment, deal.commitment],
          [words.serverSeed, deal.serverSeed],
          [words.clientSeed, deal.clientSeed],
        ].map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={[LUCKY_TEXT.k, styles.key, { color: color.inkMuted }]}>{k!.toUpperCase()}</Text>
            <Text style={[styles.hex, { color: color.inkSecondary }]} selectable>
              {v}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[LUCKY_TEXT.meta, { color: color.inkMuted }]}>
        {words.nonce(deal.nonce, deal.policyVersion)} · {words.candidates(deal.candidateCount)}
      </Text>
      <View style={styles.check} accessibilityLiveRegion="polite">
        {check === "checking" ? <PulseDot color={dot} size={8} style={styles.dot} /> : <View style={[styles.dotStill, { backgroundColor: dot }]} />}
        <Text style={[LUCKY_TEXT.caption, styles.checkText, { color: ink }]}>{line}</Text>
      </View>
      <Text style={[LUCKY_TEXT.meta, { color: color.inkMuted }]}>{words.scope}</Text>
    </Band>
  );
}

const styles = StyleSheet.create({
  kv: { gap: 4 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  key: { width: 96 },
  hex: { flex: 1, minWidth: 0, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: { marginTop: 4 },
  dotStill: { width: 8, height: 8, borderRadius: 9999, marginTop: 4 },
  checkText: { flex: 1 },
});
