import type { Side } from "@agari/core/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { setBetAgainst, sidesInOrder, useBetAgainst } from "@/features/markets/bet-against";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PRIVATE } from "@/features/private/copy";
import { TICKET, TICKET_PENDING } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { tkType, useTk } from "./tk";

export type BetMode = "dir" | "range";

/** One `.tk-mode` tile in a `.tk-modes` tray: pressed, the white wash; a private route pressed, the vermilion one. */
export function ModeTile({ label, on, disabled = false, privateTone = false, onPress }: { label: string; on: boolean; disabled?: boolean; privateTone?: boolean; onPress: () => void }) {
  const tk = useTk();
  const ink = on ? (privateTone ? tk.vermilion : tk.modeOnInk) : tk.mode;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      style={[styles.mode, on && { backgroundColor: privateTone ? tk.modePrivateOnBg : tk.modeOnBg }, disabled && styles.dim]}
    >
      <Text style={[tkType.tile, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

/** web's BetModes: call a side, or call a band — Range disabled where the RangeReserve is not deployed. */
export function BetModes({ mode, onChange, rangeAvailable }: { mode: BetMode; onChange: (mode: BetMode) => void; rangeAvailable: boolean }) {
  const tk = useTk();
  return (
    <View style={[styles.modes, { borderColor: tk.modesBorder, backgroundColor: tk.modesBg }]} accessibilityLabel={TICKET_PENDING.modeLabel}>
      <ModeTile label={TICKET_PENDING.modeDirection} on={mode === "dir"} onPress={() => onChange("dir")} />
      <ModeTile label={TICKET_PENDING.modeRange} on={mode === "range"} disabled={!rangeAvailable} onPress={() => onChange("range")} />
    </View>
  );
}

/** web's SideSegments: the two sides as one 52 px outline control, the chosen one in its wash; DOWN first while betting against. */
export function SideSegments({ side, onSelect }: { side: Side | null; onSelect: (side: Side) => void }) {
  const tk = useTk();
  const betAgainst = useBetAgainst();
  return (
    <View style={styles.sides} accessibilityRole="radiogroup" accessibilityLabel={TICKET.sideLabel}>
      {sidesInOrder(betAgainst).map((option) => {
        const on = side === option;
        const fill = on ? (option === "up" ? tk.upFill : tk.downFill) : tk.sideIdleBg;
        return (
          <Pressable
            key={option}
            onPress={() => {
              haptic.select();
              onSelect(option);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.side, { borderColor: tk.sideBorder, backgroundColor: fill }, pressed && styles.nudge]}
          >
            <Text style={[styles.sideWord, { color: option === "up" ? tk.up : tk.down }]}>{SIDE_WORD[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** web's BetAgainstToggle (A-1a): a small track switch with its word, and the sentence under it. */
export function BetAgainstToggle() {
  const tk = useTk();
  const on = useBetAgainst();
  return (
    <View style={styles.against}>
      <Pressable
        onPress={() => {
          haptic.select();
          setBetAgainst(!on);
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        style={styles.againstSwitch}
      >
        <View style={[styles.track, { borderColor: on ? tk.down : tk.trackBorder, backgroundColor: on ? tk.downFill : tk.trackBg }]}>
          <View style={[styles.thumb, { backgroundColor: on ? tk.down : tk.trackThumb }, on && styles.thumbOn]} />
        </View>
        <Text style={[tkType.tile, { color: on ? tk.down : tk.againstWord }]}>{TICKET.betAgainst}</Text>
      </Pressable>
      <Text style={[styles.againstNote, { color: tk.againstNote }]}>{on ? TICKET.betAgainstOn : TICKET.betAgainstOff}</Text>
    </View>
  );
}

/** web's PublicPrivate: two tiles in a bordered tray, and one small retry while the desk is not answering. */
export function PublicPrivate({ priv, onChange, privateEnabled, retry }: { priv: boolean; onChange: (priv: boolean) => void; privateEnabled: boolean; retry: (() => void) | null }) {
  const tk = useTk();
  const tile = (label: string, on: boolean, disabled: boolean, privateTone: boolean, next: boolean) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      style={[styles.pp, on && { backgroundColor: privateTone ? tk.modePrivateOnBg : tk.ppOnBg }]}
    >
      <Text style={[tkType.tile, { color: disabled ? tk.ppOff : on ? (privateTone ? tk.vermilion : tk.ppOnInk) : tk.pp }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.ppRow}>
      <View style={[styles.ppTray, { borderColor: tk.ppBorder }]} accessibilityLabel={TICKET.route}>
        {tile(TICKET.public, !priv, false, false, false)}
        {tile(TICKET.private, priv, !privateEnabled && !priv, true, true)}
      </View>
      {retry ? (
        <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
          <Text style={[tkType.label, styles.quiet, { color: tk.gateQuiet }]}>{PRIVATE.route.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** web's components/ui Switch at size sm: a 24 × 14 track, a 12 px thumb, vermilion when on. */
export function TkSwitch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  const tk = useTk();
  return (
    <Pressable onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} hitSlop={10}>
      <View style={[styles.switch, { backgroundColor: on ? tk.vermilion : tk.switchOff }]}>
        <View style={[styles.switchThumb, { backgroundColor: on ? tk.onVermilion : tk.switchThumb }, on && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", gap: 4, borderRadius: 6, borderWidth: 1, padding: 4 },
  mode: { flex: 1, paddingVertical: 8, borderRadius: 4 },
  dim: { opacity: 0.35 },
  sides: { flexDirection: "row", gap: 8 },
  side: { flex: 1, height: 52, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  nudge: { transform: [{ translateY: 1 }] },
  sideWord: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
  against: { gap: 6 },
  againstSwitch: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 2 },
  track: { width: 30, height: 16, borderRadius: 9999, borderWidth: 1 },
  thumb: { position: "absolute", top: 2, left: 2, width: 10, height: 10, borderRadius: 9999 },
  thumbOn: { transform: [{ translateX: 14 }] },
  againstNote: { fontFamily: FONT.body, fontSize: 11, lineHeight: 15.95 },
  ppRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ppTray: { flex: 1, flexDirection: "row", borderRadius: 8, borderWidth: 1, padding: 2 },
  pp: { flex: 1, paddingVertical: 6, borderRadius: 6 },
  quiet: { letterSpacing: 1.26 },
  switch: { width: 24, height: 14, borderRadius: 999, justifyContent: "center", paddingHorizontal: 1 },
  switchThumb: { width: 12, height: 12, borderRadius: 999 },
  switchThumbOn: { transform: [{ translateX: 10 }] },
});
