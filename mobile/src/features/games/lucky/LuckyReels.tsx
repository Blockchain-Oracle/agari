import { LUCKY_ASSETS, LUCKY_MULTIPLIERS } from "@agari/core/games";
import type { Side } from "@agari/core/types";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useGames } from "~/features/games/shell";
import { BearMark, BullMark } from "~/features/games/shell/PixelArt";
import { Reel, ReelArt } from "./Reel";
import { reelPick, reelTick } from "./reel-sfx";

/**
 * web's `LuckyReels.tsx` (`.lk-reels`, three columns, gap 8): stock, side, reach. They roll from the tap through both
 * round trips and stop only once the deal is in hand, staggered (720, 980, 1240 ms), each with its own thunk and buzz, the last one
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
    <View style={styles.reels} accessibilityLabel={LUCKY.title}>
      <Reel<string>
        {...shared}
        index={0}
        stopMs={STOPS_MS[0] ?? 0}
        last={false}
        label={LUCKY.reels.asset}
        pool={pool ?? LUCKY_ASSETS}
        target={target?.asset ?? null}
        tone={() => "asset"}
        art={(asset) => <ReelArt asset={asset} />}
        word={(asset) => asset ?? LUCKY.reels.blank}
      />
      <Reel<Side>
        {...shared}
        index={1}
        stopMs={STOPS_MS[1] ?? 0}
        last={false}
        label={LUCKY.reels.side}
        pool={SIDES}
        target={target?.side ?? null}
        tone={(side) => side}
        art={(side) => <ReelArt mark={side === "up" ? <BullMark size={44} /> : side === "down" ? <BearMark size={44} /> : undefined} />}
        word={(side) => (side ? SIDE_WORD[side] : LUCKY.reels.blank)}
      />
      <Reel<number>
        {...shared}
        index={2}
        stopMs={STOPS_MS[2] ?? 0}
        last
        label={LUCKY.reels.reach}
        pool={LUCKY_MULTIPLIERS}
        target={target?.multiplier ?? null}
        tone={() => "reach"}
        art={(m) => (m === null ? <ReelArt /> : null)}
        word={(m) => (m === null ? LUCKY.reels.blank : LUCKY.reels.multiple(m))}
        reach
      />
    </View>
  );
}

const styles = StyleSheet.create({
  reels: { flexDirection: "row", gap: 8 },
});
