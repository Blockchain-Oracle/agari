import { StyleSheet, Text, View } from "react-native";
import { emojiAvatarFor } from "@/providers/wallet/emoji-avatar";
import { AVATAR_COLORS } from "~/theme";

/** web's account avatar (RainbowKit's emojiAvatarForAddress): the address picks the colour and the emoji. */
export function Avatar({ address, size = 30 }: { address: string; size?: number }) {
  const { colorClass, emoji } = emojiAvatarFor(address);
  const index = Number(colorClass.slice("wm-ava-".length));
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_COLORS[index] ?? AVATAR_COLORS[0] }]}>
      <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ disc: { alignItems: "center", justifyContent: "center" } });
