import type { TickerSymbol } from "@agari/core/market";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ROOM } from "@/features/room/copy";
import type { RoomId } from "@/features/room/room-id";
import { useRoom } from "@/features/room/useRoom";
import { haptic } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";
import { RoomMark, RoomStates } from "./RoomStates";
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

function Head({ callLabel, switcher, onClose }: Pick<RoomSheetProps, "callLabel" | "switcher" | "onClose">) {
  const { color } = useTheme();
  return (
    <View style={[styles.head, { borderBottomColor: color.hairline }]}>
      <View style={[styles.mark, { backgroundColor: color.accentWash }]}>
        <RoomMark size={21} tint={color.accent} />
      </View>
      <View style={styles.headText}>
        <Text style={[TYPE.title, { color: color.ink }]} numberOfLines={2} accessibilityRole="header">
          {callLabel}
        </Text>
        <View style={styles.badge}>
          <SymbolView name={{ ios: "lock.fill", android: "lock" }} size={10} tintColor={color.inkMuted} />
          <Text style={[styles.badgeText, { color: color.inkMuted }]}>{ROOM.qualifier}</Text>
        </View>
        {switcher}
      </View>
      <Pressable
        onPress={() => {
          haptic.tap();
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel={ROOM.close}
        hitSlop={8}
        style={[styles.close, { backgroundColor: color.surface2 }]}
      >
        <SymbolView name={{ ios: "xmark", android: "close" }} size={14} tintColor={color.ink} />
      </Pressable>
    </View>
  );
}

function RoomBody({ roomId, ticker, onClose, onBet }: Omit<RoomSheetProps, "visible" | "callLabel" | "switcher">) {
  const room = useRoom(roomId, true);
  const leave = (to: string) => {
    onClose();
    router.push(to as never);
  };
  if (room.gate !== "joined") {
    return (
      <>
        <RoomStates
          gate={room.gate}
          ticker={ticker}
          onJoin={() => void room.join()}
          onConnect={() => leave("/connect")}
          onBet={onBet}
        />
        {room.error ? <ErrorLine text={room.error} /> : null}
      </>
    );
  }
  return (
    <RoomThread
      comments={room.comments}
      busy={room.busy}
      error={room.error}
      onPost={(body) => void room.post(body)}
      onLeave={onClose}
    />
  );
}

function ErrorLine({ text }: { text: string }) {
  const { color } = useTheme();
  return (
    <Text style={[TYPE.caption, styles.error, { color: color.loss }]} accessibilityRole="alert">
      {text}
    </Text>
  );
}

/**
 * One Room as a native page sheet — web's `RoomSheet` + `CommentRoom` (features/room/MarketRoom.tsx, CommentRoom.tsx):
 * web's gate machine (`useRoom`: connect → locked/joinable → one signed join text → joined, polled every 9 s) drawn
 * natively. It follows the theme and claims no encryption, as web's does.
 */
export function RoomSheet({ visible, callLabel, switcher, onClose, ...body }: RoomSheetProps) {
  const { color } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.fill, { backgroundColor: color.ground }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Head callLabel={callLabel} switcher={switcher} onClose={onClose} />
        {visible ? (
          <RoomBoundary fallback={(error) => <ErrorLine text={String(error?.message ?? error).slice(0, 300)} />}>
            <RoomBody onClose={onClose} {...body} />
          </RoomBoundary>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, paddingTop: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, gap: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase" },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  error: { paddingHorizontal: 24, textAlign: "center" },
});
