import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useWalletSession } from "@/lib/wallet-session";
import { Logo } from "~/components/logos/Logo";
import { Avatar } from "~/components/wallet/Avatar";
import { RADIUS, TYPE, useTheme } from "~/theme";

// 21st: dillionverma/tweet-card — avatar, name and handle, the X mark at the right, then the post's own text.
/** The X post the instruction builder composes, drawn as the post it will be. */
export function PostCard({ handle, children }: { handle: string | null; children: ReactNode }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel="Your X post preview">
      <View style={styles.head}>
        {address ? <Avatar address={address} size={40} /> : <View style={[styles.blank, { backgroundColor: color.surface2 }]} />}
        <View style={styles.who}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>You</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{handle ? `@${handle}` : "your X account"}</Text>
        </View>
        <Logo brand="x" size={18} />
      </View>
      {children}
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Preview</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  blank: { width: 40, height: 40, borderRadius: 20 },
  who: { flex: 1 },
});
