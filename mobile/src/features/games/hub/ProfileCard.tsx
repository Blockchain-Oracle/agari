import { shortHex } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import type { AccentChoice } from "@/features/games/settings";
import { GAMES } from "@/features/games/copy";
import { addressHue } from "@/lib/address-hue";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, LoadingState } from "~/components/kit";
import { useGames } from "~/features/games/shell";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's `GameProfileCard`: who you are in the games. The address that signs, its deterministic hue (or the
 * accent the player chose), and the three numbers the arena has not written yet, shown as unrecorded rather
 * than as zeros, with web's one line saying why.
 */
export function ProfileCard() {
  const { color } = useTheme();
  const { address, isConnected, connect } = useWalletSession();
  const { settings, hydrated } = useGames();

  if (!hydrated) {
    return (
      <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <LoadingState shape="row" label="Reading your games profile" />
      </View>
    );
  }

  if (!isConnected || !address) {
    return (
      <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Text style={[TYPE.title, { color: color.ink }]}>{GAMES.profile.signedOut.title}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{GAMES.profile.signedOut.body}</Text>
        <Button label="Connect a wallet" variant="outline" size="sm" icon={{ ios: "wallet.bifold", android: "account_balance_wallet" }} onPress={connect} />
      </View>
    );
  }

  const ring = avatarColor(settings.accent, address, { accent: color.accent, profit: color.profit, loss: color.loss });
  return (
    <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.id}>
        <View style={[styles.avatar, { backgroundColor: ring, borderColor: color.hairline }]} accessible={false} />
        <View style={styles.name}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{GAMES.profile.you}</Text>
          <Text style={[TYPE.data, { color: color.inkMuted }]} accessibilityLabel={`Address ${address}`}>
            {shortHex(address)}
          </Text>
        </View>
      </View>
      <View style={[styles.stats, { borderColor: color.hairline }]}>
        {[GAMES.profile.rating, GAMES.profile.record, GAMES.profile.streak].map((label, index) => (
          <View
            key={label}
            style={[styles.stat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.hairline }]}
            accessible
            accessibilityLabel={`${label}: not recorded`}
          >
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
            <Text style={[TYPE.dataLg, { color: color.inkSecondary }]}>{GAMES.profile.unrecorded}</Text>
          </View>
        ))}
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{GAMES.profile.pending}</Text>
    </View>
  );
}

/** An explicit accent replaces the address hue; `default` is the address's own deterministic hue (web's `.gm-avatar`). */
function avatarColor(accent: AccentChoice, address: string, tones: { accent: string; profit: string; loss: string }): string {
  if (accent === "vermilion") return tones.accent;
  if (accent === "up") return tones.profit;
  if (accent === "down") return tones.loss;
  return `hsl(${addressHue(address)}, 58%, 52%)`;
}

const styles = StyleSheet.create({
  plate: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 16, gap: 12 },
  id: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2 },
  name: { gap: 2 },
  stats: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
});
