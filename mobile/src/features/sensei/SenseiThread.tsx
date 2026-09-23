import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import type { SenseiMessage } from "@/features/sensei/protocol";
import { AgariMark } from "~/components/shell/AgariMark";
import { RADIUS, TYPE, useTheme } from "~/theme";

const WORD_MS = 24;

/**
 * web's `Typewriter`: the reply reveals itself word by word, whitespace kept as its own token so lines never jump.
 * Under Reduce Motion the whole reply appears at once.
 */
function Typewriter({ text, onDone, onType }: { text: string; onDone: () => void; onType?: () => void }) {
  const reduce = useReducedMotion();
  const words = text.split(/(\s+)/);
  const [shown, setShown] = useState(reduce ? words.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  const typed = useRef(onType);
  typed.current = onType;

  useEffect(() => {
    if (reduce) {
      done.current();
      return;
    }
    setShown(0);
    let index = 0;
    const id = setInterval(() => {
      index += 1;
      setShown(index);
      typed.current?.();
      if (index >= words.length) {
        clearInterval(id);
        done.current();
      }
    }, WORD_MS);
    return () => clearInterval(id);
    // Restart only when the text itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduce]);

  return <>{words.slice(0, shown).join("")}</>;
}

/** web's `.sensei-dots`: three dots breathing in turn while the reply is on its way. */
function Dots() {
  const { color } = useTheme();
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Sensei is reading">
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} tint={color.inkSecondary} />
      ))}
    </View>
  );
}

function Dot({ delay, tint }: { delay: number; tint: string }) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    if (!reduce) opacity.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.35, { duration: 360 })), -1));
  }, [reduce, delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: tint }, style]} />;
}

function Avatar() {
  const { color } = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: color.surface2, borderColor: color.hairline }]}>
      <AgariMark width={16} height={16} />
    </View>
  );
}

interface SenseiThreadProps {
  messages: SenseiMessage[];
  loading: boolean;
  typingIndex: number;
  doneTyping: () => void;
  onType: () => void;
}

// 21st: sean0205/c-message-7 — Message (start|end) › Bubble (muted | primary) › content, a thinking marker before the reply.
/**
 * web's `SenseiDrawer` thread: Sensei's turns on the leading edge with the Agari mark, the reader's in vermilion on the
 * trailing edge, the newest reply typing itself in, a failure notice in the loss ink (it is not a read).
 */
export function SenseiThread({ messages, loading, typingIndex, doneTyping, onType }: SenseiThreadProps) {
  const { color } = useTheme();
  return (
    <View style={styles.thread}>
      {messages.map((message, index) => {
        const mine = message.role === "user";
        return (
          <Animated.View key={index} entering={FadeIn.duration(180)} style={[styles.row, mine && styles.rowMine]}>
            {!mine ? <Avatar /> : null}
            <View
              style={[
                styles.bubble,
                mine
                  ? { backgroundColor: color.accent, borderColor: color.accent }
                  : { backgroundColor: color.surface1, borderColor: message.failed ? color.loss : color.hairline },
              ]}
            >
              <Text style={[TYPE.body, { color: mine ? color.onAccent : message.failed ? color.loss : color.ink }]} selectable={index !== typingIndex}>
                {!mine && index === typingIndex ? <Typewriter text={message.content} onDone={doneTyping} onType={onType} /> : message.content}
              </Text>
            </View>
          </Animated.View>
        );
      })}
      {loading ? (
        <View style={styles.row}>
          <Avatar />
          <View style={[styles.bubble, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
            <Dots />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { gap: 12 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "84%", borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10 },
  dots: { flexDirection: "row", gap: 5, paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
