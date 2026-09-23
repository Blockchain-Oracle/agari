import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { RADIUS, useTheme } from "~/theme";

/** Drawn faces, cached by seed and paper colour: the same seed always draws the same face. */
const DRAWN_CAP = 256;
const drawn = new Map<string, string>();

function persona(seed: string, paper: string): string {
  const key = `${paper}:${seed}`;
  const cached = drawn.get(key);
  if (cached !== undefined) return cached;
  const svg = createAvatar(notionists, { seed, backgroundColor: [paper.replace("#", "")], radius: 12 }).toString();
  if (drawn.size >= DRAWN_CAP) drawn.clear();
  drawn.set(key, svg);
  return svg;
}

const SIZE = { small: 28, row: 44, card: 52, hero: 72 } as const;

/**
 * web's features/strategies/AgentPortrait.tsx: the reference's DiceBear "notionists" persona on its cream paper tile,
 * drawn on the phone from the same library, so an agent is recognisable everywhere it appears.
 */
export function AgentPortrait({ seed, name, size = "card" }: { seed: string; name: string; size?: keyof typeof SIZE }) {
  const { color } = useTheme();
  const px = SIZE[size];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name}, agent portrait`}
      style={[styles.tile, { width: px, height: px, borderColor: color.creamHairline, backgroundColor: color.cream }]}
    >
      <SvgXml xml={persona(seed, color.cream)} width={px} height={px} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});
