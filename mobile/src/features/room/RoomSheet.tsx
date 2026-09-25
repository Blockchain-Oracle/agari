import type { TickerSymbol } from "@agari/core/market";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Lock, X } from "lucide-react-native";
import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { ROOM } from "@/features/room/copy";
import type { RoomId } from "@/features/room/room-id";
import { useRoom } from "@/features/room/useRoom";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { ROOM_VERMILION as V, roomTokens } from "~/theme/web/explore/room";
import { ErrorLine, RoomMark, RoomStates } from "./RoomStates";
import { RoomThread } from "./RoomThread";

export interface RoomSheetProps {
  visible: boolean;
  roomId: RoomId;
  /** "$TSLA · every Window", or a Window's call line. */
  callLabel: string;
  ticker?: TickerSymbol | null;
  onClose: () => void;
  /** Jump to placing a bet, which is what unlocks the Room. */
  onBet?: () => void;
  /** The head's "This Window · $TSLA" switch, when the Room has a ticker to switch to. */
  switcher?: ReactNode;
}

/** web's `RoomErrorBoundary`: if anything in the Room throws, the sheet shows the error and the screen stays alive. */
class RoomBoundary extends React.Component<{ fallback: (error: Error) => ReactNode; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

/** `.room-sheet`'s ground: the reference's radial glow from above the top edge (dark), Yosuku's card (light). */
function Ground() {
  const { name } = useTheme();
  const [a, b, c] = roomTokens(name).sheetStops;
  return (
    <Svg style={StyleSheet.absoluteFill} accessible={false}>
      <Defs>
        <RadialGradient id="room" cx="50%" cy="-10%" rx="130%" ry="90%" fx="50%" fy="-10%">
          <Stop offset="0" stopColor={a} />
          <Stop offset="0.46" stopColor={b} />
          <Stop offset="1" stopColor={c} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#room)" />
    </Svg>
  );
}

function Head({ callLabel, switcher, onClose }: Pick<RoomSheetProps, "callLabel" | "switcher" | "onClose">) {
  const { name, color } = useTheme();
  const t = roomTokens(name);
  return (
    <View style={[styles.head, { borderBottomColor: t.rule }]}>
      <View style={styles.mark}>
        <RoomMark size={21} tint={color.accent} />
      </View>
      <View style={styles.headText}>
        <Text style={[styles.title, { color: t.ink }]} numberOfLines={1} accessibilityRole="header">
          {callLabel}
        </Text>
        <View style={[styles.badge, { borderColor: t.rule, backgroundColor: t.inset }]}>
          <Lock size={9} strokeWidth={2.4} color={t.ink62} />
          <Text style={[styles.badgeText, { color: t.ink62 }]}>{ROOM.qualifier}</Text>
        </View>
        {switcher}
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={ROOM.close} hitSlop={10} style={styles.close}>
        <X size={16} color={t.ink45} />
      </Pressable>
    </View>
  );
}

function RoomBody({ roomId, ticker, onClose, onBet }: Omit<RoomSheetProps, "visible" | "callLabel" | "switcher">) {
  const room = useRoom(roomId, true);
  if (room.gate !== "joined") {
    return (
      <>
        <RoomStates
          gate={room.gate}
          ticker={ticker}
          onJoin={() => void room.join()}
          onConnect={() => {
            onClose();
            router.push("/connect");
          }}
          onBet={onBet}
        />
        {room.error ? <ErrorLine text={room.error} /> : null}
      </>
    );
  }
  return <RoomThread comments={room.comments} busy={room.busy} error={room.error} onPost={(body) => void room.post(body)} onLeave={onClose} />;
}

/**
 * One Room — web's `RoomSheet` + `CommentRoom` on a phone: a bottom sheet (rounded 24 at the top, up to 88 % of the
 * screen) over a 70 % black scrim, the vermilion hairline across its top edge, the head (the locked-bubble mark, the
 * call, the "bettors only" badge, the Window/ticker switch, ✕), then the gate states or the thread. web's gate
 * machine (`useRoom`) drives it; it follows the theme and claims no encryption, as web's does.
 */
export function RoomSheet({ visible, callLabel, switcher, onClose, ...body }: RoomSheetProps) {
  const { name } = useTheme();
  const t = roomTokens(name);
  const close = () => {
    haptic.tap();
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: V.scrim }]} onPress={close} accessibilityLabel={ROOM.close} />
        <View style={[styles.sheet, { borderColor: t.hairline }]}>
          <Ground />
          <LinearGradient colors={[V.clear, V.hairline, V.clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hairline} pointerEvents="none" />
          <Head callLabel={callLabel} switcher={switcher} onClose={close} />
          {visible ? (
            <RoomBoundary fallback={(error) => <ErrorLine text={String(error?.message ?? error).slice(0, 300)} />}>
              <RoomBody onClose={onClose} {...body} />
            </RoomBoundary>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "88%",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    boxShadow: `0px -20px 80px -20px ${V.glow}`,
  },
  hairline: { position: "absolute", left: 0, right: 0, top: 0, height: 1, zIndex: 20 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 20, borderBottomWidth: 1 },
  mark: {
    width: 40,
    height: 40,
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V.markBorder,
    backgroundColor: V.markFill,
    boxShadow: `0px 0px 24px -6px ${V.markGlow}`,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1, minWidth: 0 },
  title: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 22 },
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginTop: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  badgeText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14, letterSpacing: 1.08, textTransform: "uppercase" },
  close: { padding: 6, borderRadius: 999 },
});
