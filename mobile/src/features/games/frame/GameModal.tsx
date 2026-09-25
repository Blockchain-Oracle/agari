import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useGames } from "~/features/games/shell/context";
import { useGamesTokens } from "./tokens";

interface Props {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
  /** `.gm-settings-modal`: never taller than four fifths of the screen, scrolling inside itself. */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * duel.css `.du-modal-root` + `.du-modal`: a centred plate no wider than 384 over a 65 % black scrim, radius 24,
 * padding 36 / 24 / 24, gap 20, the ✕ in its corner; closed by the scrim, the ✕ or the system back. It arrives
 * as games.css `gm-enter` (280 ms, 10 px rise), or at once when motion is reduced.
 */
export function GameModal({ open, onClose, closeLabel, children, scroll, style }: Props) {
  const { t, color } = useGamesTokens();
  const { reducedMotion } = useGames();
  const { height } = useWindowDimensions();
  const plate: StyleProp<ViewStyle> = [styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }, scroll && { maxHeight: height * 0.8 }, style];
  const close = (
    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} style={styles.close} hitSlop={6}>
      <Text style={[styles.x, { color: t.modalClose }]}>✕</Text>
    </Pressable>
  );
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={[styles.root, { backgroundColor: t.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} importantForAccessibility="no" />
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(280).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })} style={styles.wrap} accessibilityViewIsModal>
          {scroll ? (
            <View style={[plate, styles.scrollPlate]}>
              <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
              {close}
            </View>
          ) : (
            <View style={[plate, styles.inner]}>
              {children}
              {close}
            </View>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  wrap: { width: "100%", maxWidth: 384 },
  plate: { width: "100%", borderRadius: 24, borderWidth: 1 },
  scrollPlate: { overflow: "hidden" },
  inner: { paddingTop: 36, paddingHorizontal: 24, paddingBottom: 24, gap: 20 },
  close: { position: "absolute", top: 12, right: 12, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  x: { fontSize: 18, lineHeight: 28.8 },
});
