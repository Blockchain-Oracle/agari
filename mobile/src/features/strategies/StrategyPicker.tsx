import type { StrategySubscription } from "@agari/core/strategies";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { strategyIdentity } from "@/features/strategies/identity";
import type { StrategyWire } from "@/features/strategies/protocol";
import { FONT } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";
import { FieldLabel, useStrat } from "./ui";

const P = STRATEGIES.picker;

function PickerRow({ card, role }: { card: StrategyWire; role: string }) {
  const { color } = useStrat();
  const { name, seed } = strategyIdentity(card);
  return (
    <View style={styles.row}>
      <AgentPortrait seed={seed} name={name} size="small" />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.name, { color: color.ink }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: color.inkMuted }]}>
          #{card.strategyId}
          {role && ` · ${role}`}
        </Text>
      </View>
    </View>
  );
}

/**
 * web's features/strategies/StrategyPicker.tsx ("Manage a strategy"): the bordered trigger with its chevron and the
 * dropping list of this wallet's strategies, each row saying why it is yours.
 */
export function StrategyPicker({ strategies, selected, onSelect, subscriptionOf, wallet, pendingId }: {
  strategies: readonly StrategyWire[];
  selected: string | null;
  onSelect: (strategyId: string) => void;
  subscriptionOf: (strategyId: string) => StrategySubscription | null;
  wallet: string | null;
  pendingId: string | null;
}) {
  const { t, color, name } = useStrat();
  const [open, setOpen] = useState(false);
  const current = strategies.find((s) => s.strategyId === selected) ?? null;
  const edge = t.ink(name === "dark" ? 0.08 : 0.11);
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
    <View style={[styles.picker, open && styles.raised]}>
      <FieldLabel style={styles.label}>{P.label}</FieldLabel>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={P.label}
        style={[styles.button, { backgroundColor: t.ink(0.03), borderColor: open ? t.ink(name === "dark" ? 0.2 : 0.22) : edge }]}
      >
        {current ? <PickerRow card={current} role={roleOf(current)} /> : <Text style={[styles.empty, { color: color.inkMuted }]}>{P.choose}</Text>}
        <ChevronDown size={14} color={color.inkMuted} style={open ? styles.flip : undefined} />
      </Pressable>
      {open ? (
        <View style={[styles.menu, { borderColor: t.ink(name === "dark" ? 0.1 : 0.11), backgroundColor: t.menuBg }]}>
          <ScrollView nestedScrollEnabled>
            {strategies.map((card) => {
              const on = card.strategyId === selected;
              return (
                <Pressable
                  key={card.strategyId}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    onSelect(card.strategyId);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.item, on ? { backgroundColor: t.ink(name === "dark" ? 0.1 : 0.08) } : pressed && { backgroundColor: t.ink(0.05) }]}
                >
                  <PickerRow card={card} role={roleOf(card)} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { marginTop: 30, maxWidth: 510, zIndex: 1 },
  raised: { zIndex: 30, elevation: 30 },
  label: { marginBottom: 8 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 11.25, minHeight: 52.5, paddingVertical: 7.5, paddingHorizontal: 11.25, borderRadius: 8, borderWidth: 1 },
  empty: { fontFamily: FONT.dataRegular, fontSize: 11.25, lineHeight: 18 },
  flip: { transform: [{ rotate: "180deg" }] },
  menu: { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, maxHeight: 270, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  item: { paddingVertical: 7.5, paddingHorizontal: 11.25 },
  row: { flexDirection: "row", alignItems: "center", gap: 11.25, minWidth: 0, flexShrink: 1 },
  rowText: { minWidth: 0, flexShrink: 1 },
  name: { fontFamily: FONT.bodyStrong, fontSize: 13.125, lineHeight: 21 },
  meta: { marginTop: 2, fontFamily: FONT.dataRegular, fontSize: 9.75, lineHeight: 15.6 },
});
