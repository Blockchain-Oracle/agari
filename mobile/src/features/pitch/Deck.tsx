import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PITCH } from "@/features/pitch/copy";
import { haptic } from "~/components/kit";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT } from "~/theme";
import { PITCH_PAPER as PP } from "~/theme/web/explore/pitch";
import { Mono, Tick } from "./Folio";

/** One folio page: the section word in the head, which paper it sits on, and its content (web pitch/types.ts). */
export interface Slide {
  id: string;
  section: string;
  paper?: 2;
  render: () => ReactNode;
}

/**
 * web PitchDeck.tsx at 402 px: cream paper edge to edge, the ruled frame (4 % in from top and bottom, 3 % from the
 * sides, vermilion registration ticks at its corners), the brand and folio line, the slide scrolling inside, the dots
 * underneath, and the two round arrows at mid-height. A new slide opens at its top and re-runs its rise.
 */
export function Deck({ slides }: { slides: readonly Slide[] }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stage = useRef<ScrollView>(null);
  const root = useRef<View>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState({ height: 0, top: 0 });
  const total = slides.length;

  useEffect(() => {
    stage.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  const goto = (to: number) => {
    const next = Math.max(0, Math.min(total - 1, to));
    if (next !== index) haptic.select();
    setIndex(next);
  };

  // Under the status bar the frame keeps clear of it; below the app's chrome it starts where the deck starts.
  const onLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    root.current?.measureInWindow((_x, y) => setBox({ height, top: Math.max(0, insets.top - y) }));
  };

  const slide = slides[index]!;
  const folio = `[ ${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")} ] · ${slide.section}`;
  const inner = Math.max(0, box.height - box.top);
  const frame = { top: box.top + inner * 0.04, bottom: inner * 0.04, left: width * 0.03, right: width * 0.03, paddingHorizontal: width * 0.05 };

  return (
    <View ref={root} onLayout={onLayout} style={[styles.deck, { backgroundColor: slide.paper === 2 ? PP.paper2 : PP.paper }]}>
      <View style={[styles.frame, frame]}>
        <Tick pos="tl" />
        <Tick pos="tr" />
        <Tick pos="bl" />
        <Tick pos="br" />

        <View style={styles.head}>
          <View style={styles.brand}>
            <AgariMark width={19} height={19} figure={PP.ink} />
            <Text style={styles.brandName}>{PITCH.brand}</Text>
          </View>
          <Mono tone="faint" accessibilityLiveRegion="polite">
            {folio}
          </Mono>
        </View>

        <ScrollView ref={stage} style={styles.stage} contentContainerStyle={styles.stageBody} showsVerticalScrollIndicator={false}>
          <View key={slide.id} style={styles.slide}>
            {slide.render()}
          </View>
        </ScrollView>

        <View style={styles.foot}>
          <Mono tone="faint" size={10}>
            {PITCH.brand}
          </Mono>
          <View style={styles.dots}>
            {slides.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => goto(i)}
                hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={PITCH.slideLabel(i + 1)}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      </View>

      <Pressable onPress={() => goto(index - 1)} style={[styles.nav, styles.prev]} accessibilityRole="button" accessibilityLabel={PITCH.prev}>
        <ArrowLeft size={17} color={PP.ink} />
      </Pressable>
      <Pressable onPress={() => goto(index + 1)} style={[styles.nav, styles.next]} accessibilityRole="button" accessibilityLabel={PITCH.next}>
        <ArrowRight size={17} color={PP.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { flex: 1, overflow: "hidden" },
  frame: { position: "absolute", borderLeftWidth: 1, borderRightWidth: 1, borderColor: PP.hair },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: PP.hair },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontFamily: FONT.headingHeavy, fontSize: 15, lineHeight: 24, letterSpacing: -0.15, color: PP.ink },
  stage: { flex: 1 },
  stageBody: { paddingVertical: 10 },
  slide: { paddingTop: 12, paddingBottom: 24 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 13, paddingBottom: 15 },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: PP.dot },
  dotActive: { width: 22, backgroundColor: PP.verm },
  nav: { position: "absolute", top: "50%", marginTop: -16, width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: PP.hair, backgroundColor: PP.card, alignItems: "center", justifyContent: "center", zIndex: 30 },
  prev: { left: 4 },
  next: { right: 4 },
});
