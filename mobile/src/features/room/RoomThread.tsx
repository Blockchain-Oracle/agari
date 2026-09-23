import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ROOM } from "@/features/room/copy";
import { ROOM_BODY_MAX, type RoomComment } from "@/features/room/protocol";
import { haptic } from "~/components/kit";
import { HueAvatar } from "~/features/social/HueAvatar";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

/** web's own `timeAgo` for the Room (CommentRoom.tsx L35–42). */
function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

interface RoomThreadProps {
  comments: RoomComment[];
  busy: boolean;
  error: string | null;
  onPost: (body: string) => void;
  /** Close the sheet before leaving it for a profile. */
  onLeave: () => void;
}

// 21st: rmahammad/comment-thread — avatar, author · time, then the body; own lines on the trailing edge.
/**
 * The joined Room — web's `CommentRoom` thread and composer: each line is the author's hue avatar, their short address
 * (or "you") linking to their profile, the time, and the words; the composer caps at 280 and collapses whitespace.
 */
export function RoomThread({ comments, busy, error, onPost, onLeave }: RoomThreadProps) {
  const { color } = useTheme();
  const [draft, setDraft] = useState("");
  const listRef = useRef<ScrollView>(null);

  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [comments.length]);

  const send = () => {
    // Collapse runs of whitespace, as web does, so a wall of newlines cannot be used to shout.
    const text = draft.replace(/\s+/g, " ").trim().slice(0, ROOM_BODY_MAX);
    if (!text || busy) return;
    haptic.tap();
    onPost(text);
    setDraft("");
  };

  const remaining = ROOM_BODY_MAX - draft.length;
  const canSend = !busy && draft.trim().length > 0;

  return (
    <View style={styles.fill}>
      <ScrollView ref={listRef} style={styles.fill} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {comments.length === 0 ? <Text style={[TYPE.body, styles.empty, { color: color.inkMuted }]}>{ROOM.empty}</Text> : null}
        {comments.map((comment) => (
          <View key={comment.id} style={[styles.line, comment.mine && styles.lineMine]}>
            <HueAvatar address={comment.author} size={30} initials />
            <View
              style={[
                styles.bubble,
                { backgroundColor: comment.mine ? color.accentWash : color.surface1, borderColor: comment.mine ? color.accentDim : color.hairline },
              ]}
            >
              <View style={styles.meta}>
                <Pressable
                  onPress={() => {
                    haptic.tap();
                    onLeave();
                    router.push(`/u/${comment.author}`);
                  }}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${comment.mine ? "your" : shortAddress(comment.author)} profile`}
                  hitSlop={10}
                >
                  <Text style={[styles.author, { color: comment.mine ? color.accent : color.ink }]}>
                    {comment.mine ? "you" : shortAddress(comment.author)}
                  </Text>
                </Pressable>
                <Text style={[styles.time, { color: color.inkMuted }]}>{timeAgo(comment.createdAtMs)}</Text>
              </View>
              <Text style={[TYPE.body, { color: color.ink }]} selectable>
                {comment.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {error ? (
        <Text style={[TYPE.caption, styles.error, { color: color.loss }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={[styles.compose, { borderTopColor: color.hairline, backgroundColor: color.ground }]}>
        <View style={[styles.inputWrap, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
          <TextInput
            value={draft}
            onChangeText={(text) => setDraft(text.slice(0, ROOM_BODY_MAX))}
            placeholder={ROOM.compose}
            placeholderTextColor={color.inkMuted}
            accessibilityLabel={ROOM.compose}
            maxLength={ROOM_BODY_MAX}
            multiline
            style={[TYPE.body, styles.input, { color: color.ink }]}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={send}
          />
          <Text style={[styles.count, { color: remaining <= 40 ? color.warning : color.inkMuted }]} accessible={false}>
            {remaining}
          </Text>
        </View>
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={busy ? ROOM.sending : ROOM.send}
          accessibilityState={{ disabled: !canSend, busy }}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: canSend ? color.accent : color.surface2, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={color.onAccent} />
          ) : (
            <SymbolView name={{ ios: "paperplane.fill", android: "send" }} size={18} tintColor={canSend ? color.onAccent : color.inkMuted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: 16, gap: 14 },
  empty: { textAlign: "center", paddingVertical: 32 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  lineMine: { flexDirection: "row-reverse" },
  bubble: { flexShrink: 1, maxWidth: "84%", borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  author: { fontFamily: FONT.dataStrong, fontSize: 12 },
  time: { fontFamily: FONT.data, fontSize: 11 },
  error: { paddingHorizontal: 16, paddingBottom: 6 },
  compose: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderWidth: 1, borderRadius: RADIUS.xl, paddingLeft: 14, paddingRight: 10, minHeight: 44 },
  input: { flex: 1, paddingTop: 10, paddingBottom: 10, maxHeight: 120 },
  count: { fontFamily: FONT.data, fontSize: 11, paddingBottom: 13 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
