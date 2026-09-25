import { txUrl } from "@agari/core/urls";
import { StyleSheet, Text, View } from "react-native";
import type { DeskWriteResult } from "@/features/strategies/useDeskWrites";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { AgentPortrait } from "../AgentPortrait";
import { Confirm, Sensei, ST, useStrat } from "../ui";
import { Body } from "./parts";

const NEXT = [
  "Open Your strategies and select this agent.",
  "Choose a copy budget, review the fee and approve its bounded permission.",
  "Wait for the runner’s first real decision. A held call is a valid result; a fill has its own transaction.",
];

/** web CreatorStudio's published state (builder.css `.agent-published`): the receipt, the next steps, the way on. */
export function Published({ published, seed, name, onPublished, onAnother }: { published: DeskWriteResult; seed: string; name: string; onPublished?: () => void; onAnother: () => void }) {
  const { color } = useStrat();
  return (
    <View accessibilityLiveRegion="polite" style={styles.wrap}>
      <AgentPortrait seed={seed} name={name} />
      <View>
        <Text style={[ST.micro, { color: color.accent }]}>{published.ok ? "Published on Solana" : "Publication needs checking"}</Text>
        <Text style={[ST.h2, styles.mt8, { color: color.ink }]}>{name}</Text>
      </View>
      <Body>
        {published.ok
          ? "Your strategy is registered. Publishing has not deposited money or enabled trades from your wallet."
          : "The transaction result is uncertain. Check the receipt and Your strategies before publishing again."}
      </Body>
      {published.txHash ? <Sensei label="View publication transaction ↗" onPress={() => void openExternal(txUrl(published.txHash!))} /> : null}
      <View style={styles.steps}>
        {NEXT.map((line, i) => (
          <View key={line} style={styles.step}>
            <Text style={[styles.stepText, styles.num, { color: color.ink }]}>{i + 1}.</Text>
            <Text style={[styles.stepText, styles.flex, { color: color.ink }]}>{line}</Text>
          </View>
        ))}
      </View>
      <Confirm live label="View your strategies →" onPress={onPublished} style={styles.mt12} />
      {published.ok ? <Sensei label="Create another agent →" onPress={onAnother} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 15, marginVertical: 30 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  steps: { gap: 12, paddingLeft: 4 },
  step: { flexDirection: "row", gap: 6 },
  num: { width: 14 },
  flex: { flex: 1 },
  stepText: { fontFamily: FONT.body, fontSize: 13.125, lineHeight: 21 },
});
