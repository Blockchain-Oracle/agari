import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { LUCKY } from "@/features/games/lucky/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { CoinMark } from "~/features/games/shell/PixelArt";
import { PIXEL_FONT } from "~/theme/web/games";
import { CrtFace, useLuckyTokens } from "./parts";
import { reelLock } from "./reel-sfx";

/**
 * One reel of web's `LuckyReels.tsx` (`.lk-reel`): the pixel label over a CRT face with the art up top, the value
 * in the pixel face below and a foot bar that lights when the reel lands. While moving, the face steps to the NEXT
 * value in the pool every 60 ms with the art dimmed; it lands at its own stop time with a 1.06 → 1 thunk, the value
 * and the foot bar taking the reel's tone. Reduced motion leaves the face blank until the deal, then lands at once.
 */
const CYCLE_MS = 60;
const FACE = 112;

export type ReelTone = "asset" | "up" | "down" | "reach";

interface ReelProps<T> {
  index: number;
  label: string;
  pool: readonly T[];
  target: T | null;
  cycling: boolean;
  landing: boolean;
  reduced: boolean;
  haptics: boolean;
  /** When this reel lands, counted from the deal's arrival. */
  stopMs: number;
  last: boolean;
  tone: (value: T) => ReelTone;
  /** The art above the value (`.lk-face-art`); null shows the coin. */
  art: (value: T | null) => ReactNode;
  word: (value: T | null) => string;
  reach?: boolean;
  onStop: (index: number) => void;
}

export function Reel<T>({ index, label, pool, target, cycling, landing, reduced, haptics, stopMs, last, tone, art, word, reach, onStop }: ReelProps<T>) {
  const { color } = useLuckyTokens();
  const [shown, setShown] = useState<T | null>(null);
  const [locked, setLocked] = useState(false);
  const stopRef = useRef(onStop);
  stopRef.current = onStop;
  const scale = useSharedValue(1);

  // Idle or already dealt: the face shows the target, or nothing.
  useEffect(() => {
    if (cycling || landing) return;
    setShown(target);
    setLocked(target !== null);
  }, [cycling, landing, target]);

  // Moving: step the pool; landing: schedule this reel's stop.
  useEffect(() => {
    if (!cycling && !landing) return;
    setLocked(false);
    let at = index % Math.max(1, pool.length);
    const interval = reduced
      ? null
      : setInterval(() => {
          at = (at + 1) % pool.length;
          setShown(pool[at] ?? null);
        }, CYCLE_MS);
    if (reduced) setShown(null);
    const stop =
      landing && target !== null
        ? setTimeout(
            () => {
              if (interval) clearInterval(interval);
              setShown(target);
              setLocked(true);
              if (!reduced) scale.value = withSequence(withTiming(1.06, { duration: 0 }), withTiming(1, { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
              reelLock(last, haptics);
              stopRef.current(index);
            },
            reduced ? 0 : stopMs,
          )
        : null;
    return () => {
      if (interval) clearInterval(interval);
      if (stop) clearTimeout(stop);
    };
    // `haptics` and `last` are read when the reel lands; a change mid-spin should not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycling, landing, target, index, pool, reduced, stopMs, scale]);

  const thunk = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const moving = cycling || (landing && !locked);
  const t = shown === null ? null : tone(shown);
  const lit = locked && t !== null ? (t === "up" ? color.profit : t === "down" ? color.loss : color.accent) : null;

  return (
    <View style={styles.reel} accessible accessibilityLabel={`${label}: ${locked && target !== null ? word(target) : LUCKY.reels.blank}`}>
      <Text style={[styles.k, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
      <Animated.View style={thunk}>
        <CrtFace height={FACE}>
          <View style={[styles.art, moving && styles.artMoving, lit && (t === "up" || t === "down") ? [styles.glow, { shadowColor: lit }] : null]}>{art(shown)}</View>
          <Text
            style={[
              styles.v,
              reach && styles.vReach,
              { color: lit ?? color.inkSecondary },
              lit ? { textShadowColor: lit, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } } : null,
            ]}
            numberOfLines={1}
          >
            {word(shown).toUpperCase()}
          </Text>
          <View style={[styles.foot, { backgroundColor: lit ?? color.inkDisabled, opacity: lit ? 1 : 0.35 }]} />
        </CrtFace>
      </Animated.View>
    </View>
  );
}

/** `.lk-face-art`: the stock's disc, the bull or bear, or the coin while nothing is dealt — 44 px. */
export function ReelArt({ asset, mark }: { asset?: string | null; mark?: ReactNode }) {
  if (asset) return <AssetDisc asset={asset} size={44} />;
  return <>{mark ?? <CoinMark size={44} />}</>;
}

const styles = StyleSheet.create({
  reel: { flex: 1, minWidth: 0, gap: 6 },
  k: { fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 19.2, letterSpacing: 2.4, textAlign: "center" },
  art: { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center" },
  artMoving: { opacity: 0.7 },
  glow: { shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  v: { position: "absolute", bottom: 12, left: 4, right: 4, zIndex: 4, textAlign: "center", fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, letterSpacing: 2.2, fontVariant: ["tabular-nums"] },
  vReach: { fontSize: 33, lineHeight: 33, letterSpacing: 3.3 },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, zIndex: 4 },
});
