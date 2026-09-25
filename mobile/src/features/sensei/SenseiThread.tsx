import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import type { SenseiMessage } from "@/features/sensei/protocol";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, useTheme } from "~/theme";
import { senseiTokens } from "~/theme/web/explore/sensei";

const WORD_MS = 24;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** `.sd-caret`: the vermilion brush tip blinking at the end of the typing reply. */
function Caret() {
  const { color } = useTheme();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: 0 }), withDelay(360, withTiming(0, { duration: 0 })), withDelay(360, withTiming(1, { duration: 0 }))), -1);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.caret, { backgroundColor: color.accent }, style]} />;
}

/** web's `Typewriter`: word by word, whitespace its own token so lines never jump; Reduce Motion shows it whole. */
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

  return (
    <>
      {words.slice(0, shown).join("")}
      {!reduce && shown < words.length ? <Caret /> : null}
    </>
  );
}

/** `.sensei-dots`: three vermilion dots breathing in turn while the reply is on its way. */
function Dots() {
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Sensei is reading">
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 150} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    if (!reduce) opacity.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.5, { duration: 500 })), -1));
  }, [reduce, delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color.accent }, style]} />;
}

/** `.sd-ava`: the Agari mark in a soft vermilion seal. */
function Avatar() {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  return (
    <View style={[styles.ava, { backgroundColor: t.avaFill, borderColor: t.avaBorder }]}>
      <AgariMark width={11} height={11} figure={color.accent} />
    </View>
  );
}

/** `.sd-row`'s arrival: up 9 px and in over 340 ms. */
function Pop({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const entering = () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 9 }, { scale: 0.985 }] },
      animations: {
        opacity: withTiming(1, { duration: 340, easing: EASE }),
        transform: [{ translateY: withTiming(0, { duration: 340, easing: EASE }) }, { scale: withTiming(1, { duration: 340, easing: EASE }) }],
      },
    };
  };
  return (
    <Animated.View entering={reduce ? undefined : entering} style={[styles.row, mine && styles.rowMine]}>
      {children}
    </Animated.View>
  );
}

interface SenseiThreadProps {
  messages: SenseiMessage[];
  loading: boolean;
  typingIndex: number;
  doneTyping: () => void;
  onType: () => void;
}

/**
 * web's `SenseiDrawer` thread (`.sensei-drawer-msgs`): Sensei's bubbles on the left behind the seal, squared at the
 * bottom-left corner; the reader's in vermilion on the right, squared at the bottom-right; the newest reply typing in.
 */
export function SenseiThread({ messages, loading, typingIndex, doneTyping, onType }: SenseiThreadProps) {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  const bot = [styles.msg, styles.bot, { backgroundColor: t.botFill, borderColor: t.botBorder, boxShadow: `0px 2px 9px -5px ${t.botShadow}` }];
  return (
    <>
      {messages.map((message, index) => {
        const mine = message.role === "user";
        return (
          <Pop key={index} mine={mine}>
            {!mine ? <Avatar /> : null}
            <View style={mine ? [styles.msg, styles.user, { backgroundColor: color.accent, boxShadow: `0px 3px 12px -6px ${t.userShadow}` }] : bot}>
              <Text style={[styles.text, { color: mine ? color.onAccent : t.botInk }]} selectable={index !== typingIndex}>
                {!mine && index === typingIndex ? <Typewriter text={message.content} onDone={doneTyping} onType={onType} /> : message.content}
              </Text>
            </View>
          </Pop>
        );
      })}
      {loading ? (
        <Pop mine={false}>
          <Avatar />
          <View style={bot}>
            <Dots />
          </View>
        </Pop>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  ava: { width: 27, height: 27, borderRadius: 13.5, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  msg: { maxWidth: "82%", borderRadius: 17, paddingVertical: 11, paddingHorizontal: 14 },
  bot: { borderWidth: 1, borderBottomLeftRadius: 6 },
  user: { borderBottomRightRadius: 6 },
  text: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21.7 },
  caret: { width: 2, height: 14.7, marginLeft: 1.5, borderRadius: 1, transform: [{ translateY: 2 }] },
  dots: { flexDirection: "row", alignItems: "center", gap: 4, height: 21.7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
