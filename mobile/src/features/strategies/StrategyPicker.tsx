import type { StrategySubscription } from "@agari/core/strategies";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { strategyIdentity } from "@/features/strategies/identity";
import type { StrategyWire } from "@/features/strategies/protocol";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";

const P = STRATEGIES.picker;

/**
 * web's `StrategyPicker` (features/strategies/StrategyPicker.tsx): "Manage a strategy" as a bordered trigger with a
 * chevron and a dropping list — portrait, name, #id and why each strategy is yours.
 */
export function StrategyPicker({ strategies, selected, onSelect, subscriptionOf, wallet, pendingId }: {
  strategies: readonly StrategyWire[];
  selected: string | null;
  onSelect: (strategyId: string) => void;
  subscriptionOf: (strategyId: string) => StrategySubscription | null;
  wallet: string | null;
  pendingId: string | null;
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  const current = strategies.find((s) => s.strategyId === selected) ?? null;

  const roleOf = (card: StrategyWire) => {
    const sub = subscriptionOf(card.strategyId);
    const roles: string[] = [];
    if (card.creator === wallet) roles.push(P.published);
    if (pendingId === card.strategyId) roles.push(P.pending);
    else if (sub?.active) roles.push(sub.fade ? P.fading : P.copying);
    else if (sub) roles.push(P.paused);
    return roles.join(" · ");
  };

  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={P.label}
        onPress={() => {
          haptic.select();
          setOpen((o) => !o);
        }}
        style={[styles.trigger, { backgroundColor: color.surface1, borderColor: open ? color.borderStrong : color.hairline }]}
      >
        <View style={styles.grow}>
          {current ? <PickerRow card={current} role={roleOf(current)} /> : <Text style={[TYPE.body, { color: color.inkMuted }]}>{P.choose}</Text>}
        </View>
        <SymbolView name={open ? { ios: "chevron.up", android: "expand_less" } : { ios: "chevron.down", android: "expand_more" }} size={14} tintColor={color.inkMuted} />
      </Pressable>
      {open ? (
        <View style={[styles.menu, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityRole="list">
          {strategies.map((card) => {
            const on = card.strategyId === selected;
            return (
              <Pressable
                key={card.strategyId}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  haptic.select();
                  onSelect(card.strategyId);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.item, { backgroundColor: on ? color.accentWash : pressed ? color.surface2 : "transparent" }]}
              >
                <PickerRow card={card} role={roleOf(card)} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function PickerRow({ card, role }: { card: StrategyWire; role: string }) {
  const { color } = useTheme();
  const { name, seed } = strategyIdentity(card);
  return (
    <View style={styles.row}>
      <AgentPortrait seed={seed} name={name} size="small" />
      <View style={styles.grow}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.meta, { color: color.inkMuted }]} numberOfLines={1}>#{card.strategyId}{role ? ` · ${role}` : ""}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  trigger: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1 },
  grow: { flex: 1, minWidth: 0 },
  menu: { borderRadius: RADIUS.md, borderWidth: 1, paddingVertical: 4, overflow: "hidden" },
  item: { paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  meta: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 0.3 },
});
