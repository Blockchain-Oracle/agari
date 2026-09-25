import { router } from "expo-router";
import { Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOM } from "@/features/room/copy";
import { ROOM_BODY_MAX, type RoomComment } from "@/features/room/protocol";
import { addressHue } from "@/lib/address-hue";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { ROOM_VERMILION as V, roomAvatar, roomTokens } from "~/theme/web/explore/room";
import { ErrorLine } from "./RoomStates";

const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

/** web's own `timeAgo` for the Room (CommentRoom.tsx). */
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

/**
 * The joined Room — web's `CommentRoom` thread and composer (room-thread.css): each line is the author's hue disc
 * (the address's first two characters, exactly), their short address (or "you") linking to their profile, the time,
 * and the words, a member's own lines on the right in the vermilion tint; the pill composer counts down from 280.
 */
export function RoomThread({ comments, busy, error, onPost, onLeave }: RoomThreadProps) {
  const { name, color } = useTheme();
  const t = roomTokens(name);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const listRef = useRef<ScrollView>(null);

  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 60);
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
    <>
      <ScrollView ref={listRef} style={styles.thread} contentContainerStyle={styles.threadBody} keyboardShouldPersistTaps="handled">
        {comments.length === 0 ? <Text style={[styles.empty, { color: t.ink40 }]}>{ROOM.empty}</Text> : null}
        {comments.map((comment) => {
          const disc = roomAvatar(name, addressHue(comment.author));
          return (
            <View key={comment.id} style={[styles.line, comment.mine && styles.lineMine]}>
              <View style={[styles.avatar, { backgroundColor: disc.fill }]}>
                <Text style={[styles.avatarText, { color: disc.ink }]}>{comment.author.slice(0, 2)}</Text>
              </View>
              <View style={[styles.bubble, comment.mine ? { borderColor: V.mineBorder, backgroundColor: V.mineFill } : { borderColor: t.rule, backgroundColor: t.inset }]}>
                <View style={styles.meta}>
                  <Text
                    style={[styles.author, { color: t.ink40 }]}
                    onPress={() => {
                      onLeave();
                      router.push(`/u/${comment.author}`);
                    }}
                    accessibilityRole="link"
                  >
                    {comment.mine ? "you" : shortAddress(comment.author)}
                  </Text>
                  <Text style={[styles.metaText, { color: t.ink40 }]}>{timeAgo(comment.createdAtMs)}</Text>
                </View>
                <Text style={[styles.body, { color: t.ink90 }]} selectable>
                  {comment.body}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {error ? <ErrorLine text={error} /> : null}

      <View style={[styles.compose, { borderTopColor: t.rule, paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput
          value={draft}
          onChangeText={(text) => setDraft(text.slice(0, ROOM_BODY_MAX))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={ROOM.compose}
          placeholderTextColor={t.ink35}
          accessibilityLabel={ROOM.compose}
          maxLength={ROOM_BODY_MAX}
          returnKeyType="send"
          onSubmitEditing={send}
          style={[styles.input, { color: t.ink, borderColor: focused ? V.focus : t.rule, backgroundColor: t.inset }]}
        />
        <Text style={[styles.count, { color: remaining <= 40 ? color.accent : t.ink35 }]} accessible={false}>
          {remaining}
        </Text>
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={busy ? ROOM.sending : ROOM.send}
          accessibilityState={{ disabled: !canSend, busy }}
          style={[styles.send, { backgroundColor: color.accent, opacity: canSend ? 1 : 0.4 }]}
        >
          <Send size={15} color={color.onAccent} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  thread: { flexGrow: 0, flexShrink: 1 },
  threadBody: { gap: 14, paddingVertical: 18, paddingHorizontal: 20 },
  empty: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, textAlign: "center", paddingVertical: 24 },
  line: { flexDirection: "row", gap: 10 },
  lineMine: { flexDirection: "row-reverse" },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: FONT.dataStrong, fontSize: 10 },
  bubble: { minWidth: 0, maxWidth: "78%", borderWidth: 1, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  meta: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 3 },
  author: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 0.18 },
  metaText: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 0.72, textTransform: "uppercase" },
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  compose: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 14 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, fontFamily: FONT.body, fontSize: 13 },
  count: { fontFamily: FONT.dataRegular, fontSize: 10, fontVariant: ["tabular-nums"] },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
