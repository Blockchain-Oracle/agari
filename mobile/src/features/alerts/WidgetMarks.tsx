import { File } from "expo-file-system";
import { widgetsDirectory } from "expo-widgets";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { AssetDisc } from "~/components/marks/AssetDisc";

/** Drawn at 3× the widget's 24-pt slot, so the mark stays sharp on every iPhone. */
const DRAW_PX = 72;

/** The shared-container URL a widget or Live Activity reads a stock's mark from (`Image uiImage`). */
export function markUrl(asset: string): string {
  return widgetsDirectory ? new File(widgetsDirectory, `mark-${asset}.png`).uri : "";
}

const written = new Set<string>();

/**
 * The stock marks the widget and the Live Activity draw (S26.4): each asset's own AssetDisc, the same mark the app
 * shows, captured once off-screen and written to the app group so the widget runtime (which cannot draw SVG or
 * import the app's code) can show the real brand. Calls `onReady` whenever a new mark lands. iOS only.
 */
export function WidgetMarks({ assets, onReady }: { assets: readonly string[]; onReady: () => void }) {
  const [queue, setQueue] = useState<string[]>([]);
  const ref = useRef<View>(null);
  const current = queue[0] ?? null;

  useEffect(() => {
    if (Platform.OS !== "ios" || !widgetsDirectory) return;
    const missing = assets.filter((a) => !written.has(a) && !new File(widgetsDirectory!, `mark-${a}.png`).exists);
    for (const a of assets) if (!missing.includes(a)) written.add(a);
    if (missing.length) setQueue((q) => [...q, ...missing.filter((a) => !q.includes(a))]);
  }, [assets]);

  useEffect(() => {
    if (!current || !ref.current || !widgetsDirectory) return;
    let cancelled = false;
    // One frame for the SVG to paint before it is captured.
    const id = requestAnimationFrame(() => {
      void (async () => {
        try {
          const tmp = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile", width: DRAW_PX, height: DRAW_PX });
          await new File(tmp).copy(new File(widgetsDirectory!, `mark-${current}.png`), { overwrite: true });
          written.add(current);
          if (!cancelled) onReady();
        } catch {
          // A mark that cannot be written leaves the row with its ticker alone; nothing else depends on it.
          written.add(current);
        } finally {
          if (!cancelled) setQueue((q) => q.slice(1));
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [current, onReady]);

  if (!current) return null;
  return (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={ref} collapsable={false} style={styles.slot}>
        <AssetDisc asset={current} size={DRAW_PX / 3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -1000, top: 0 },
  slot: { width: DRAW_PX / 3, height: DRAW_PX / 3, backgroundColor: "transparent" },
});
