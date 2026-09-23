import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * The app's four haptic words. iOS uses the Taptic Engine's semantic feedback; Android uses the system haptic
 * constants (`performAndroidHapticsAsync`), which Expo recommends over the raw vibrator the iOS calls fall back to.
 */
const android = Platform.OS === "android";

export const haptic = {
  /** A selection moved: a tab, a chip, a slider detent, a swipe. */
  select(): void {
    void (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick) : Haptics.selectionAsync());
  },
  /** A press that does something: a button, a card. */
  tap(): void {
    void (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  /** Something landed: a signature, a fill, a win. */
  success(): void {
    void (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  /** Something was refused: a failed send, a loss. */
  error(): void {
    void (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  /** A heavy moment: the verdict stamp, a match found. */
  heavy(): void {
    void (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
};
