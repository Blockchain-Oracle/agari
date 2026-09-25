import { X } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Keyframe, useReducedMotion } from "react-native-reanimated";
import { TUTORIAL_STEPS, TUTORIAL_UI } from "@/features/onboarding/steps";
import { useWalletSession } from "@/lib/wallet-session";
import { WebButton } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { activityTokens } from "~/theme/web/portfolio-activity";

/** tutorial.css `tutorial-step-in`: from opacity 0, 20 px down and 0.95 scale, over 200 ms. */
const STEP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 20 }, { scale: 0.95 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(200);

interface Props {
  step: number;
  onStep: (step: number) => void;
  onDismiss: () => void;
  onConnect: () => void;
}

/** web TutorialChoice.tsx: the closing screen ends on Connect, the description as fine print under it. */
function Choice({ description, onConnect }: { description: string; onConnect: () => void }) {
  const t = activityTokens(useTheme().name);
  return (
    <>
      <View style={[styles.box, { borderColor: t.tutBoxBorder, backgroundColor: t.tutBoxFill }]}>
        <Text style={[styles.eyebrow, { color: t.tutFine }]}>{TUTORIAL_UI.lastStep}</Text>
        <Text style={[styles.connectTitle, { color: t.tutInk }]}>{TUTORIAL_UI.connectTitle}</Text>
        <Text style={[styles.connectNote, { color: t.tutNote }]}>{TUTORIAL_UI.connectNote}</Text>
        <View style={styles.center}>
          <WebButton label="Connect" onPress={onConnect} />
        </View>
      </View>
      <Text style={[styles.fine, { color: t.tutFine }]}>{description}</Text>
    </>
  );
}

/**
 * web features/onboarding/Tutorial.tsx at 402 px: the card sits 16 px off the bottom and both sides (tutorial.css),
 * rounded-2xl with a white/10 hairline over neutral-900/95 (cream in light). Title and Close, the step's copy, then
 * the progress bars, Skip and Next ("Get started" never shows: the last screen ends on Connect). Each step re-enters
 * with web's 200 ms rise-and-scale. Connecting on the last screen finishes the walkthrough, as on web.
 */
export function TutorialCard({ step, onStep, onDismiss, onConnect }: Props) {
  const { name, color } = useTheme();
  const t = activityTokens(name);
  const reduce = useReducedMotion();
  const { address } = useWalletSession();
  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    if (isLast && address) onDismiss();
  }, [isLast, address, onDismiss]);

  if (!current) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.tutCard, borderColor: t.tutBorder }]} accessibilityViewIsModal accessibilityLabel={current.title}>
      <Animated.View key={step} entering={reduce ? undefined : STEP_IN}>
        <View>
          <View style={styles.head}>
            <Text style={[styles.title, { color: t.tutInk }]} accessibilityRole="header">
              {current.title}
            </Text>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={TUTORIAL_UI.close} style={styles.close} hitSlop={4}>
              <X size={16} color={t.tutFine} />
            </Pressable>
          </View>
          <View style={styles.body}>
            {current.choice ? <Choice description={current.description} onConnect={onConnect} /> : <Text style={[styles.description, { color: t.tutBody }]}>{current.description}</Text>}
          </View>
        </View>
      </Animated.View>

      <View style={styles.foot}>
        <View style={styles.dots} accessibilityLabel={TUTORIAL_UI.progress(step + 1, TUTORIAL_STEPS.length)}>
          {TUTORIAL_STEPS.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === step ? { width: 24, backgroundColor: color.accent } : { backgroundColor: i < step ? t.tutDotPast : t.tutDotAhead }]} />
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onDismiss} accessibilityRole="button" style={({ pressed }) => [styles.skip, pressed ? styles.pressed : null]}>
            <Text style={[styles.skipText, { color: t.tutNote }]}>{TUTORIAL_UI.skip}</Text>
          </Pressable>
          {!current.choice ? (
            <Pressable
              onPress={() => (isLast ? onDismiss() : onStep(step + 1))}
              accessibilityRole="button"
              style={({ pressed }) => [styles.next, { backgroundColor: color.accent }, pressed ? styles.down : null]}
            >
              <Text style={[styles.nextText, { color: color.onAccent }]}>{isLast ? TUTORIAL_UI.done : TUTORIAL_UI.next}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", left: 16, right: 16, bottom: 16, borderRadius: 15, borderWidth: 1, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingTop: 32, paddingHorizontal: 32, paddingBottom: 12 },
  title: { flex: 1, fontFamily: FONT.heading, fontSize: 22.5, lineHeight: 30 },
  close: { width: 44, height: 44, marginTop: -4, marginRight: -8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  body: { paddingVertical: 20, paddingHorizontal: 32 },
  description: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24.375 },
  box: { borderRadius: 12, borderWidth: 1, padding: 16 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 4 },
  connectTitle: { fontFamily: FONT.bodyStrong, fontSize: 13.125, lineHeight: 18.75, marginBottom: 2 },
  connectNote: { fontFamily: FONT.body, fontSize: 11.25, lineHeight: 15.5, marginBottom: 12 },
  center: { alignItems: "center" },
  fine: { marginTop: 12, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, paddingBottom: 32 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 4, borderRadius: 9999 },
  actions: { flexDirection: "row", gap: 8 },
  skip: { height: 48, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
  pressed: { opacity: 0.7 },
  /* Button default size with `rounded-lg text-sm font-bold tracking-wider uppercase` */
  next: { height: 48, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nextText: { fontFamily: FONT.bodyStrong, fontSize: 13.125, lineHeight: 18.75, letterSpacing: 0.656, textTransform: "uppercase" },
  down: { transform: [{ translateY: 1 }] },
});
