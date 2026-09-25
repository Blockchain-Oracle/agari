import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TICKET } from "@/lib/copy";
import { useTheme } from "~/theme";
import { useTk } from "./tk";

/** `.tk-drawer`: 300 ms on web's `--ease`, cubic-bezier(.4, 0, .2, 1). */
const SLIDE_MS = 300;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);
/** `max-width: 440px`; below it the drawer is the full width. */
const MAX_W = 440;

const CloseContext = createContext<() => void>(() => undefined);
/** Slides the drawer out, then leaves the route: the ✕, a placed call's "done", anything that ends the ticket. */
export const useCloseTicket = () => useContext(CloseContext);

/**
 * web's TicketDock below 1024 px, drawn over everything (the route is a clear modal): `.tk-drawer-backdrop` — 70 %
 * black over a 4 px blur, a tap closes — and the `.tk-drawer` panel, full height at the right edge, full width up to
 * 440 px, its 1 px left rule, sliding in from 100 % over 300 ms. No grabber: it closes on the ✕, the scrim or back.
 */
export function TicketFrame({ children }: { children: ReactNode }) {
  const tk = useTk();
  const { name } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(MAX_W, screen);
  const open = useSharedValue(0);

  useEffect(() => {
    open.value = withTiming(1, { duration: SLIDE_MS, easing: EASE });
  }, [open]);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/markets");
  }, []);
  const close = useCallback(() => {
    open.value = withTiming(0, { duration: SLIDE_MS, easing: EASE }, (done) => {
      if (done) runOnJS(leave)();
    });
  }, [open, leave]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - open.value) * width }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: open.value }));

  return (
    <CloseContext.Provider value={close}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, scrim]}>
          <BlurView intensity={10} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tk.scrim }]} onPress={close} accessibilityRole="button" accessibilityLabel={TICKET.close} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={TICKET.title}
          style={[styles.panel, { width, paddingTop: insets.top, backgroundColor: tk.drawerBg, borderLeftColor: tk.drawerEdge, shadowColor: tk.drawerShadow }, panel]}
        >
          {children}
        </Animated.View>
      </View>
    </CloseContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // box-shadow 0 25px 50px -12px rgba(0, 0, 0, 0.25)
  panel: { position: "absolute", top: 0, right: 0, bottom: 0, borderLeftWidth: 1, shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 25 }, elevation: 24 },
});
