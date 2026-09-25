import type { TickerSymbol } from "@agari/core/market";
import { ArrowRight, Lock, ShieldCheck, Unplug } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Path, RadialGradient, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { ROOM } from "@/features/room/copy";
import type { RoomGate } from "@/features/room/protocol";
import { FONT, useTheme } from "~/theme";
import { ROOM_VERMILION as V, roomTokens } from "~/theme/web/explore/room";

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

/** web's `StateIcon` (`.room-state-icon`): a 56 px rounded tile on a 64 px radial halo. */
function StateIcon({ children, tone = "muted" }: { children: ReactNode; tone?: "vermilion" | "muted" }) {
  const { name } = useTheme();
  const t = roomTokens(name);
  const vermilion = tone === "vermilion";
  return (
    <View style={styles.icon}>
      <Svg style={StyleSheet.absoluteFill} accessible={false}>
        <Defs>
          <RadialGradient id={`halo-${tone}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" {...stopPaint(vermilion ? V.halo : t.ink10)} />
            <Stop offset="0.7" {...stopPaint(vermilion ? V.clear : t.inset, 0)} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" rx={16} fill={`url(#halo-${tone})`} />
      </Svg>
      <View style={[styles.tile, { borderColor: vermilion ? V.iconBorder : t.hairline }]}>{children}</View>
    </View>
  );
}

/** web's `.room-cta`: the vermilion pill. */
function Cta({ label, onPress, disabled, busy, arrow }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; arrow?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.cta, { backgroundColor: color.accent, opacity: disabled ? 0.6 : 1 }]}>
      {busy ? <ActivityIndicator size="small" color={color.onAccent} /> : null}
      <Text style={[styles.ctaText, { color: color.onAccent }]}>{label}</Text>
      {arrow ? <ArrowRight size={15} color={color.onAccent} /> : null}
    </Pressable>
  );
}

/** web's `.room-error`: the failure line, read before the next attempt. */
export function ErrorLine({ text }: { text: string }) {
  const { name, color } = useTheme();
  const t = roomTokens(name);
  return (
    <Text style={[styles.error, { color: color.loss, borderTopColor: t.lossRule, backgroundColor: t.lossFill }]} accessibilityRole="alert">
      {text}
    </Text>
  );
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
 * you cannot speak yet, and what would change that — in web's own words, in `.room-state`'s centred column.
 */
export function RoomStates({ gate, onJoin, onConnect, onBet, ticker = null }: RoomStatesProps) {
  const { name, color } = useTheme();
  const t = roomTokens(name);
  const words = (title: string, body: string) => (
    <>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: t.ink50 }]}>{body}</Text>
    </>
  );

  if (gate === "unavailable") {
    return (
      <View style={styles.state}>
        <StateIcon>
          <Unplug size={24} strokeWidth={1.8} color={t.ink50} />
        </StateIcon>
        {words(ROOM.states.unavailable.title, ROOM.states.unavailable.body)}
      </View>
    );
  }

  if (gate === "connect") {
    return (
      <View style={styles.state}>
        <StateIcon>
          <RoomMark size={26} tint={t.ink50} />
        </StateIcon>
        {words(ROOM.states.connect.title, ROOM.states.connect.body)}
        <Cta label={ROOM.connect} onPress={onConnect} />
      </View>
    );
  }

  if (gate === "locked") {
    return (
      <View style={styles.state}>
        <StateIcon>
          <Lock size={24} strokeWidth={1.8} color={t.ink50} />
        </StateIcon>
        {words(ticker ? ROOM.ticker.locked.title(ticker) : ROOM.states.locked.title, ticker ? ROOM.ticker.locked.body : ROOM.states.locked.body)}
        {onBet ? <Cta label={ROOM.bet} onPress={onBet} arrow /> : null}
      </View>
    );
  }

  return (
    <View style={styles.state}>
      <StateIcon tone="vermilion">
        <ShieldCheck size={26} strokeWidth={1.8} color={color.accent} />
      </StateIcon>
      {words(ticker ? ROOM.ticker.joinable.title(ticker) : ROOM.states.joinable.title, ticker ? ROOM.ticker.joinable.body : ROOM.states.joinable.body)}
      <Cta label={gate === "joining" ? ROOM.joining : ROOM.join} onPress={onJoin} disabled={gate === "joining"} busy={gate === "joining"} />
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: "center", gap: 16, padding: 36 },
  icon: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  tile: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT.headingSemi, fontSize: 17, lineHeight: 24, textAlign: "center" },
  body: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, textAlign: "center" },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 20 },
  error: { borderTopWidth: 1, paddingVertical: 9, paddingHorizontal: 16, fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 15.75 },
});
