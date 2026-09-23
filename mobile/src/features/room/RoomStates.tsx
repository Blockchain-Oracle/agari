import type { TickerSymbol } from "@agari/core/market";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { ROOM } from "@/features/room/copy";
import type { RoomGate } from "@/features/room/protocol";
import { Button } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** web's `RoomMark`: a locked speech bubble — "a private conversation" in one glyph. */
export function RoomMark({ size = 22, tint }: { size?: number; tint?: string }) {
  const { color } = useTheme();
  const ink = tint ?? color.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="M5.2 3.6h13.6A2.7 2.7 0 0 1 21.5 6.3v7A2.7 2.7 0 0 1 18.8 16H11l-4.3 3.5a.6.6 0 0 1-1-.47V16H5.2A2.7 2.7 0 0 1 2.5 13.3v-7A2.7 2.7 0 0 1 5.2 3.6Z"
        stroke={ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Rect x={8.9} y={9.7} width={6.2} height={4.5} rx={1.1} stroke={ink} strokeWidth={1.3} />
      <Path d="M10.4 9.7V8.4a1.6 1.6 0 0 1 3.2 0v1.3" stroke={ink} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

/** web's `StateIcon`: the haloed mark that carries each onboarding state. */
function StateIcon({ children, tone = "muted" }: { children: ReactNode; tone?: "vermilion" | "muted" }) {
  const { color } = useTheme();
  const vermilion = tone === "vermilion";
  return (
    <View
      style={[
        styles.icon,
        { backgroundColor: vermilion ? color.accentWash : color.surface2, borderColor: vermilion ? color.accentDim : color.hairline },
      ]}
    >
      {children}
    </View>
  );
}

function Glyph({ name, tint }: { name: SymbolViewProps["name"]; tint: string }) {
  return <SymbolView name={name} size={24} tintColor={tint} />;
}

interface RoomStatesProps {
  gate: Exclude<RoomGate, "joined">;
  onJoin: () => void;
  onConnect: () => void;
  onBet?: () => void;
  ticker?: TickerSymbol | null;
}

/**
 * web's `RoomStates` (features/room/RoomStates.tsx): everything before the thread. Each state says what this is, why
 * you cannot speak yet, and what would change that — in web's own words.
 */
export function RoomStates({ gate, onJoin, onConnect, onBet, ticker = null }: RoomStatesProps) {
  const { color } = useTheme();
  const title = (text: string) => <Text style={[TYPE.title, styles.center, { color: color.ink }]}>{text}</Text>;
  const body = (text: string) => <Text style={[TYPE.body, styles.center, { color: color.inkSecondary }]}>{text}</Text>;

  if (gate === "unavailable") {
    return (
      <View style={styles.state}>
        <StateIcon>
          <Glyph name={{ ios: "powerplug", android: "power_off" }} tint={color.inkSecondary} />
        </StateIcon>
        {title(ROOM.states.unavailable.title)}
        {body(ROOM.states.unavailable.body)}
      </View>
    );
  }

  if (gate === "connect") {
    return (
      <View style={styles.state}>
        <StateIcon>
          <RoomMark size={26} tint={color.inkSecondary} />
        </StateIcon>
        {title(ROOM.states.connect.title)}
        {body(ROOM.states.connect.body)}
        <Button label={ROOM.connect} onPress={onConnect} block={false} style={styles.cta} />
      </View>
    );
  }

  if (gate === "locked") {
    return (
      <View style={styles.state}>
        <StateIcon>
          <Glyph name={{ ios: "lock.fill", android: "lock" }} tint={color.inkSecondary} />
        </StateIcon>
        {title(ticker ? ROOM.ticker.locked.title(ticker) : ROOM.states.locked.title)}
        {body(ticker ? ROOM.ticker.locked.body : ROOM.states.locked.body)}
        {onBet ? <Button label={ROOM.bet} onPress={onBet} block={false} trailing="→" style={styles.cta} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.state}>
      <StateIcon tone="vermilion">
        <Glyph name={{ ios: "checkmark.shield.fill", android: "verified_user" }} tint={color.accent} />
      </StateIcon>
      {title(ticker ? ROOM.ticker.joinable.title(ticker) : ROOM.states.joinable.title)}
      {body(ticker ? ROOM.ticker.joinable.body : ROOM.states.joinable.body)}
      <Button
        label={gate === "joining" ? ROOM.joining : ROOM.join}
        loading={gate === "joining"}
        onPress={onJoin}
        block={false}
        style={styles.cta}
        icon={{ ios: "signature", android: "draw" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 32 },
  icon: { width: 64, height: 64, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  center: { textAlign: "center" },
  cta: { alignSelf: "center", marginTop: 4 },
});
