import { MIRROR_WITHIN_MAX_SEC, MIRROR_WITHIN_MIN_SEC } from "@agari/core/strategies";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { FONT } from "~/theme";
import type { StudioDraft } from "@/features/strategies/studio-draft";
import { FieldLabel, StratInput, useStrat } from "../ui";
import { Body, Chip } from "./parts";
import type { SetDraft } from "./StudioForm";

const WITHIN_CHOICES = [60, 120, 300, 900] as const;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** web's features/strategies/StudioMirrorFields.tsx: whose calls, and how fresh one has to be. */
export function StudioMirrorFields({ form, setForm }: { form: StudioDraft; setForm: SetDraft }) {
  const { t, color } = useStrat();
  const words = STRATEGIES.studio.mirror;
  const trader = form.trader.trim();
  const bad = trader.length > 0 && !BASE58.test(trader);
  return (
    <View style={styles.space24}>
      <View>
        <FieldLabel>{words.traderLabel}</FieldLabel>
        <StratInput value={form.trader} autoCapitalize="none" autoCorrect={false} spellCheck={false} onChangeText={(v) => setForm((f) => ({ ...f, trader: v.trim() }))} placeholder={words.traderPlaceholder} style={styles.mt2} />
        {bad ? (
          <Text style={[styles.error, { borderLeftColor: t.vermilion, color: color.ink }]}>{words.traderInvalid}</Text>
        ) : (
          <Body style={styles.mt8}>{words.traderHelp}</Body>
        )}
        {!bad ? <Body style={styles.mt8}>{words.traderScope}</Body> : null}
      </View>
      <View>
        <FieldLabel>{words.withinLabel}</FieldLabel>
        <View style={styles.chips}>
          {WITHIN_CHOICES.filter((sec) => sec >= MIRROR_WITHIN_MIN_SEC && sec <= MIRROR_WITHIN_MAX_SEC).map((sec) => (
            <Chip key={sec} label={sec < 60 ? `${sec}s` : `${sec / 60}m`} on={form.mirrorWithinSec === sec} onPress={() => setForm((f) => ({ ...f, mirrorWithinSec: sec }))} />
          ))}
        </View>
        <Body style={styles.mt8}>{words.withinHelp}</Body>
      </View>
      <Body>{words.caveat}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  space24: { gap: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mt2: { marginTop: 2 },
  mt8: { marginTop: 8 },
  error: { marginTop: 8, borderLeftWidth: 2, paddingVertical: 11.25, paddingHorizontal: 15, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
});
