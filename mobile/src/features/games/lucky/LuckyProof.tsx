import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyDealWire } from "@/features/games/lucky/lucky-wire";
import { useLuckyCheck } from "@/features/games/lucky/useLuckyCheck";
import { haptic } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's `LuckyDeal.tsx` Proof band: the commitment and both seeds, and the check replayed on this phone — the server
 * seed must hash to the commitment and the HMAC over both seeds must map to the very draw on screen. The seeds fold
 * away behind the verdict line so the deal stays one screen tall; the verdict is always shown.
 */
export function LuckyProof({ deal }: { deal: LuckyDealWire }) {
  const { color } = useTheme();
  const check = useLuckyCheck(deal);
  const [open, setOpen] = useState(false);
  const words = LUCKY.deal.proof;
  const line = check === "checking" ? words.checking : check === "verified" ? words.verified : check === "mismatch" ? words.mismatch : words.unavailable;
  const dot = check === "verified" ? color.profit : check === "mismatch" ? color.loss : color.inkMuted;

  return (
    <View style={[styles.band, { borderColor: color.hairline }]}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.label}</Text>
      <View style={styles.check} accessibilityRole="text" accessibilityLiveRegion="polite">
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={[TYPE.caption, styles.checkText, { color: check === "mismatch" ? color.loss : color.ink }]}>{line}</Text>
      </View>
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? "Hide the seeds" : "Show the seeds"}
        hitSlop={8}
        style={styles.toggle}
      >
        <Text style={[TYPE.caption, { color: color.accent }]}>{open ? "Hide the seeds" : "Show the seeds"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.seeds}>
          <Seed label={words.commitment} value={deal.commitment} />
          <Seed label={words.serverSeed} value={deal.serverSeed} />
          <Seed label={words.clientSeed} value={deal.clientSeed} />
        </View>
      ) : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {words.nonce(deal.nonce, deal.policyVersion)} · {words.candidates(deal.candidateCount)}
      </Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.scope}</Text>
    </View>
  );
}

function Seed({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.seed}>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{label}</Text>
      <Text style={[TYPE.data, styles.hex, { color: color.ink, backgroundColor: color.surface2 }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  checkText: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  toggle: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  seeds: { gap: 8 },
  seed: { gap: 3 },
  hex: { fontSize: 11.5, lineHeight: 16, padding: 8, borderRadius: RADIUS.sm },
});
