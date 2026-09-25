import { diagnosisCopy, ERROR_BOUNDARY } from "@agari/core/copy";
import type { Diagnosis } from "@agari/core/types";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Skeleton } from "~/components/kit";
import { FONT } from "~/theme";
import { DT, useDeskTheme } from "../kit";

/** web's shadcn Button at `size="sm"`: 44 px tall, 12 px sides, 8 px corners; secondary fills, ghost does not. */
function SmallButton({ label, variant, onPress }: { label: string; variant: "secondary" | "ghost"; onPress: () => void }) {
  const { color } = useDeskTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.button, variant === "secondary" ? { backgroundColor: color.surface2 } : pressed && { backgroundColor: color.surface2 }]}>
      <Text style={[styles.buttonText, { color: color.ink }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * web's components/states ErrorState (inline): the diagnosis in human words, Try again and Back when given, and the
 * technical detail behind a disclosure.
 */
export function DeskErrorState({ diagnosis, retry, backHref }: { diagnosis: Diagnosis; retry?: () => void; backHref?: string }) {
  const { color } = useDeskTheme();
  const [open, setOpen] = useState(false);
  const copy = diagnosisCopy(diagnosis.kind);
  const offerRetry = retry !== undefined && diagnosis.kind !== "not-deployed";
  return (
    <View accessibilityRole="alert" style={[styles.error, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <View style={styles.errorText}>
        <Text style={[styles.headline, { color: color.ink }]}>{copy.headline}</Text>
        <Text style={[DT.body, { color: color.inkSecondary }]}>{copy.body}</Text>
      </View>
      {offerRetry || backHref ? (
        <View style={styles.buttons}>
          {offerRetry ? <SmallButton label={ERROR_BOUNDARY.retry} variant="secondary" onPress={retry} /> : null}
          {backHref ? <SmallButton label={ERROR_BOUNDARY.back} variant="ghost" onPress={() => router.push(backHref as Href)} /> : null}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[DT.caption, { color: color.inkMuted }]}>
          {open ? "▾" : "▸"} {ERROR_BOUNDARY.technical}
        </Text>
      </Pressable>
      {open ? (
        <Text style={[DT.caption, styles.technical, { color: color.inkSecondary }]} selectable>
          {diagnosis.kind}
          {diagnosis.errorName ? ` · ${diagnosis.errorName}` : ""}
          {"\n"}
          {diagnosis.technical}
        </Text>
      ) : null}
    </View>
  );
}

/** web's LoadingState `shape="plate"`: one 96 px skeleton block, the only thing shown while the record is read. */
export function PlateSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Skeleton height={96} radius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: FONT.bodyMedium, fontSize: 14 },
  error: { gap: 12, padding: 16, borderWidth: 1, borderRadius: 12 },
  errorText: { gap: 4 },
  headline: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23.25 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  technical: { marginTop: 8, fontFamily: FONT.dataRegular },
});
