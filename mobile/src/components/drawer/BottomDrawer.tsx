import { BlurView } from "expo-blur";
import { createContext, useCallback, useContext, useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "~/theme";

/** The rise: a firm spring with no visible bounce past the top. */
const SPRING = { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: true } as const;
const OUT = { duration: 220, easing: Easing.in(Easing.quad) };
/** Past a quarter of its height, or flicked faster than this, a drag closes the drawer. */
const CLOSE_FRACTION = 0.25;
const CLOSE_VELOCITY = 900;

const DrawerScroll = Animated.createAnimatedComponent(ScrollView);

const DrawerContext = createContext<(after?: () => void) => void>(() => undefined);

/** Closes the drawer from inside it — the same slide-down as a drag — then runs `after` (a navigation, say). */
export function useDrawerClose(): (after?: () => void) => void {
  return useContext(DrawerContext);
}

interface BottomDrawerProps {
  /** Called once the drawer has slid away (by drag, scrim, back button or `useDrawerClose`). */
  onClose: () => void;
  children: ReactNode;
  /** The panel's paper; the theme's surface-1 by default. */
  background?: string;
  /** A hairline around the panel's top edge, where the design has one. */
  border?: string;
  /** The panel's inner padding (the handle sits above it). */
  contentStyle?: StyleProp<ViewStyle>;
  /** The scrim's and the close button's accessible name. */
  closeLabel: string;
  /** Tallest the panel grows before its content scrolls, as a fraction of the window. */
  maxHeight?: number;
  /** Something drawn over the panel's top-right (a close X), inside its frame. */
  corner?: ReactNode;
  /** Receives the animated close, for the screen that renders the drawer itself (a result that lands later, say). */
  closeRef?: MutableRefObject<DrawerClose | null>;
}

export type DrawerClose = (after?: () => void) => void;

/**
 * The app's one bottom drawer (Add funds, the funded card, connect, account; the ticket reuses it): a blurred scrim
 * that fades in, a panel that springs up from the bottom sized to its content with rounded top corners and a grab
 * handle, drag-down to dismiss (distance or velocity) that hands over to the content's own scroll, the safe area kept
 * under it, and the keyboard pushing it up so an amount field stays in view. Reduce Motion swaps the spring for a fade.
 */
export function BottomDrawer({ onClose, children, background, border, contentStyle, closeLabel, maxHeight = 0.9, corner, closeRef }: BottomDrawerProps) {
  const { name, color } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduce = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const height = useSharedValue(windowHeight);
  const drag = useSharedValue(windowHeight);
  const scrim = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const opened = useRef(false);
  const closing = useRef(false);

  const finish = useCallback(
    (after?: () => void) => {
      onClose();
      after?.();
    },
    [onClose],
  );

  const close = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      scrim.value = withTiming(0, OUT);
      drag.value = withTiming(reduce ? drag.value : height.value + insets.bottom, OUT, (done) => {
        if (done) runOnJS(finish)(after);
      });
    },
    [drag, finish, height, insets.bottom, reduce, scrim],
  );

  if (closeRef) closeRef.current = close;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const onLayout = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height;
    if (opened.current) return;
    opened.current = true;
    scrim.value = withTiming(1, { duration: 200 });
    if (reduce) drag.value = 0;
    else {
      drag.value = e.nativeEvent.layout.height;
      drag.value = withSpring(0, SPRING);
    }
  };

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .simultaneousWithExternalGesture(native)
    .onUpdate((e) => {
      if (scrollY.value > 0) return;
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
    })
    .onEnd((e) => {
      if (scrollY.value > 0 && drag.value <= 0) return;
      if (drag.value > height.value * CLOSE_FRACTION || e.velocityY > CLOSE_VELOCITY) runOnJS(close)();
      else drag.value = withSpring(0, SPRING);
    });

  const panelStyle = useAnimatedStyle(() => ({
    opacity: reduce ? scrim.value : 1,
    transform: [{ translateY: drag.value - keyboard.height.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const keyboardPad = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, insets.bottom - keyboard.height.value) }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <DrawerContext.Provider value={close}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <BlurView intensity={12} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]} onPress={() => close()} accessibilityRole="button" accessibilityLabel={closeLabel} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={onLayout}
            accessibilityViewIsModal
            style={[
              styles.panel,
              { maxHeight: windowHeight * maxHeight, backgroundColor: background ?? color.surface1 },
              border ? { borderColor: border, borderWidth: 1, borderBottomWidth: 0 } : null,
              panelStyle,
            ]}
          >
            <View style={styles.handleZone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.handle, { backgroundColor: color.borderStrong }]} />
            </View>
            <GestureDetector gesture={native}>
              <DrawerScroll onScroll={onScroll} scrollEventThrottle={16} bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Animated.View style={[contentStyle, keyboardPad]}>{children}</Animated.View>
              </DrawerScroll>
            </GestureDetector>
            {corner ? <View style={styles.corner}>{corner}</View> : null}
          </Animated.View>
        </GestureDetector>
      </DrawerContext.Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  panel: { width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  handleZone: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  corner: { position: "absolute", top: 12, right: 12 },
});
