import { LUCKY_ASSETS, LUCKY_MULTIPLIERS } from "@agari/core/games";
import type { Side } from "@agari/core/types";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useGames } from "~/features/games/shell";
import { useTheme } from "~/theme";
import { Reel, ReelFace } from "./Reel";
import { reelPick, reelTick } from "./reel-sfx";

/**
 * web's `LuckyReels.tsx`: three reels — stock, side, reach. They roll from the tap through both round trips and stop
 * only once the deal is in hand, staggered (720, 980, 1240 ms), each with its own thunk and buzz, the last one
 * heavier; the pick is then held lit for a beat before the card appears. Reduced motion keeps every state and drops
 * the movement: the reels sit blank until the deal, then land together.
 */
const TICK_MS = 110;
const STOPS_MS: readonly number[] = [720, 980, 1_240];
const LOCKIN_MS = 480;
const SIDES: readonly Side[] = ["up", "down"];

export interface ReelTarget {
  asset: string;
  side: Side;
  multiplier: number;
}

interface Props {
  cycling: boolean;
  landing: boolean;
  target: ReelTarget | null;
  reduced: boolean;
  /** The last reel has stopped and the lock-in beat has passed. */
  onLanded: () => void;
  /** The names this spin can draw: the 24/7 lanes alone while no stock Window trades. */
  pool?: readonly string[];
}

export function LuckyReels({ cycling, landing, target, reduced, onLanded, pool }: Props) {
  const { color } = useTheme();
  const { settings } = useGames();
  const haptics = settings.haptics;
  const [stopped, setStopped] = useState(0);
  const landedRef = useRef(onLanded);
  landedRef.current = onLanded;

  // A new spin resets the count of landed reels.
  useEffect(() => {
    if (cycling) setStopped(0);
  }, [cycling]);

  // The ratchet under the whole spin: one stream, never one per reel.
  const moving = cycling || (landing && stopped < STOPS_MS.length);
  useEffect(() => {
    if (!moving || reduced) return;
    const interval = setInterval(() => reelTick(haptics), TICK_MS);
    return () => clearInterval(interval);
  }, [moving, reduced, haptics]);

  // The last reel lands, the pick is held lit for a beat, then the machine commits.
  useEffect(() => {
    if (!landing || stopped < STOPS_MS.length || !target) return;
    const timer = setTimeout(
      () => {
        reelPick(haptics);
        AccessibilityInfo.announceForAccessibility(LUCKY.reels.announce(target.asset, SIDE_WORD[target.side], target.multiplier));
        landedRef.current();
      },
      reduced ? 0 : LOCKIN_MS,
    );
    return () => clearTimeout(timer);
  }, [landing, stopped, target, reduced, haptics]);

  const onStop = () => setStopped((n) => n + 1);
  const shared = { cycling, landing, reduced, haptics, onStop };

  return (
    <View style={styles.row} accessibilityRole="none" accessibilityLabel={LUCKY.title}>
      <Reel<string>
        {...shared}
        index={0}
        stopMs={STOPS_MS[0] ?? 0}
        last={false}
        label={LUCKY.reels.asset}
        pool={pool ?? LUCKY_ASSETS}
        target={target?.asset ?? null}
        render={(asset) => <ReelFace kind="asset" asset={asset} text={asset} ink={color.ink} />}
      />
      <Reel<Side>
        {...shared}
        index={1}
        stopMs={STOPS_MS[1] ?? 0}
        last={false}
        label={LUCKY.reels.side}
        pool={SIDES}
        target={target?.side ?? null}
        render={(side) => <ReelFace kind={side} text={SIDE_WORD[side]} ink={side === "up" ? color.profit : color.loss} />}
      />
      <Reel<number>
        {...shared}
        index={2}
        stopMs={STOPS_MS[2] ?? 0}
        last
        label={LUCKY.reels.reach}
        pool={LUCKY_MULTIPLIERS}
        target={target?.multiplier ?? null}
        render={(m) => <ReelFace kind="reach" text={LUCKY.reels.multiple(m)} ink={color.accent} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
});
