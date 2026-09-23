import { useRef } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

/**
 * Keeps the ticket's scroll inside its content. Inside a form sheet, a body that shrinks under the thumb (the top-up
 * gate leaving as a quote lands, the keypad's block reflowing) can leave the offset past the new end, and the sheet
 * then shows an empty page above its CTA. When the content shrinks, the offset is pulled back to the last full page.
 */
export function useClampedScroll() {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  return {
    ref,
    scrollEventThrottle: 32,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y;
    },
    onLayout: (event: LayoutChangeEvent) => {
      viewport.current = event.nativeEvent.layout.height;
    },
    onContentSizeChange: (_width: number, height: number) => {
      const end = Math.max(0, height - viewport.current);
      if (offset.current > end) ref.current?.scrollTo({ y: end, animated: false });
    },
  };
}
