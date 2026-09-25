import { Layers, Plus, Wallet, Zap } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { FONT } from "~/theme";
import { ConnectButton, useEarnParlay } from "~/features/earn/EarnKit";

interface LegPlateProps {
  count: number;
  maxLegs: number;
  presetAsset: string | null;
  presetDisabled: boolean;
  onPreset: () => void;
  /** The Windows are still reading and no leg exists yet. */
  loading: boolean;
  noWindows: boolean;
  onAdd: () => void;
  /** The legs, one `LegRow` each. */
  children: ReactNode[];
}

/**
 * web's left plate in `ParlayBuilder.tsx` (`.pl-plate`): "Your legs n/max" with the close-streak preset, then the
 * loading line, the empty state with its first-leg button, or the legs and "Add another market".
 */
export function LegPlate({ count, maxLegs, presetAsset, presetDisabled, onPreset, loading, noWindows, onAdd, children }: LegPlateProps) {
  const { color, t } = useEarnParlay();
  const { builder } = PARLAY;
  return (
    <View style={[styles.plate, { borderColor: t.plateBorder, backgroundColor: t.plateBg }]}>
      <View style={[styles.head, { borderBottomColor: t.plateRule }]}>
        <View style={styles.title}>
          <Layers size={16} color={color.accent} />
          <Text style={[styles.name, { color: color.ink }]}>{builder.yourLegs}</Text>
          <Text style={[styles.count, { color: color.inkDisabled }]}>
            {count}/{maxLegs}
          </Text>
        </View>
        <Pressable
          onPress={onPreset}
          disabled={presetDisabled}
          accessibilityRole="button"
          style={({ pressed }) => [styles.preset, { borderColor: t.vermilion30, backgroundColor: pressed ? t.vermilion10 : t.vermilion6, opacity: presetDisabled ? 0.4 : 1 }]}
        >
          <Zap size={12} color={color.accent} />
          <Text style={[styles.presetText, { color: color.accent }]}>{builder.preset(presetAsset)}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {loading ? (
          <Text style={[styles.loading, { color: color.inkDisabled }]}>{builder.loading}</Text>
        ) : count === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: color.inkSecondary }]}>{builder.noLegs}</Text>
            <Text style={[styles.emptyBody, { color: color.inkDisabled }]}>{builder.noLegsBody}</Text>
            <Pressable
              onPress={onAdd}
              disabled={noWindows}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addFirst, { backgroundColor: pressed ? color.accentPressed : color.accent, opacity: noWindows ? 0.4 : 1 }]}
            >
              <Plus size={16} color={color.onAccent} />
              <Text style={[styles.addFirstText, { color: color.onAccent }]}>{builder.addFirst}</Text>
            </Pressable>
          </View>
        ) : (
          children
        )}

        {count > 0 && count < maxLegs ? (
          <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [styles.addMore, { borderColor: pressed ? t.inputFocus : t.toggleBorder }]}>
            {({ pressed }) => (
              <>
                <Plus size={14} color={pressed ? t.gray300 : color.inkMuted} />
                <Text style={[styles.addMoreText, { color: pressed ? t.gray300 : color.inkMuted }]}>{builder.addAnother}</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** web's `.pl-connect`: the wallet glyph, "Connect your wallet to build a parlay", the sub line and Connect. */
export function ParlayConnect() {
  const { color, t } = useEarnParlay();
  return (
    <View style={[styles.connect, { borderColor: t.plateBorder, backgroundColor: t.plateBg }]}>
      <Wallet size={32} color={color.inkDisabled} style={styles.connectIcon} />
      <Text style={[styles.connectTitle, { color: color.inkSecondary }]}>{PARLAY.connect.title}</Text>
      <Text style={[styles.connectSub, { color: color.inkDisabled }]}>{PARLAY.connect.sub}</Text>
      <ConnectButton />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: 16, borderWidth: 1, zIndex: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, gap: 8 },
  title: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  name: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 21, letterSpacing: 0.35 },
  count: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  preset: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexShrink: 1 },
  presetText: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 16.5, letterSpacing: 0.55, textTransform: "uppercase" },
  body: { padding: 20, gap: 12 },
  loading: { paddingVertical: 48, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 20 },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyTitle: { marginBottom: 4, fontFamily: FONT.body, fontSize: 14, lineHeight: 21 },
  emptyBody: { marginBottom: 16, maxWidth: 230, textAlign: "center", fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5 },
  addFirst: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  addFirstText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 20 },
  addMore: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  addMoreText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  connect: { padding: 32, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  connectIcon: { marginBottom: 12 },
  connectTitle: { marginBottom: 4, textAlign: "center", fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  connectSub: { marginBottom: 16, textAlign: "center", fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
});
