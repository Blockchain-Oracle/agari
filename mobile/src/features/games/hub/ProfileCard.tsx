import { shortHex } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import type { AccentChoice } from "@/features/games/settings";
import { addressHue } from "@/lib/address-hue";
import { useWalletSession } from "@/lib/wallet-session";
import { LoadingState } from "~/components/kit";
import { Plate, PlateBody, PlateMeta, PlateTitle, useGamesTokens } from "~/features/games/frame";
import { useGames } from "~/features/games/shell";
import { FONT } from "~/theme";

/**
 * web's `GameProfileCard`: who you are in the games — the signing address, its deterministic hue (or the accent
 * the player chose), and the rating, record and streak the arena has not written, shown as unrecorded rather
 * than as zeros, with one line saying why.
 */
export function ProfileCard() {
  const { t, color } = useGamesTokens();
  const { address, isConnected } = useWalletSession();
  const { settings, hydrated } = useGames();

  if (!hydrated) {
    return (
      <Plate>
        <LoadingState shape="row" label="Reading your games profile" />
      </Plate>
    );
  }
  if (!isConnected || !address) {
    return (
      <Plate>
        <PlateTitle>{GAMES.profile.signedOut.title}</PlateTitle>
        <PlateBody>{GAMES.profile.signedOut.body}</PlateBody>
      </Plate>
    );
  }

  const fill = avatarColor(settings.accent, address, { accent: color.accent, profit: color.profit, loss: color.loss });
  return (
    <Plate>
      <View style={styles.id}>
        <View style={[styles.ring, { borderColor: t.avatarRing }]}>
          <View style={[styles.avatar, { backgroundColor: fill }]} />
        </View>
        <View style={styles.name}>
          <Text style={[styles.you, { color: color.ink }]}>{GAMES.profile.you}</Text>
          <Text style={[styles.addr, { color: color.inkMuted }]} accessibilityLabel={`Address ${address}`}>
            {shortHex(address)}
          </Text>
        </View>
      </View>
      <View style={styles.stats}>
        {[GAMES.profile.rating, GAMES.profile.record, GAMES.profile.streak].map((label) => (
          <View key={label} style={styles.stat} accessible accessibilityLabel={`${label}: not recorded`}>
            <Text style={[styles.statLabel, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
            <Text style={[styles.statValue, { color: color.inkDisabled }]}>{GAMES.profile.unrecorded}</Text>
          </View>
        ))}
      </View>
      <PlateMeta>{GAMES.profile.pending}</PlateMeta>
    </Plate>
  );
}

/** `.gm-avatar`: an explicit accent replaces the address hue; `default` is the address's own hsl(hue 58% 52%). */
function avatarColor(accent: AccentChoice, address: string, tones: { accent: string; profit: string; loss: string }): string {
  if (accent === "vermilion") return tones.accent;
  if (accent === "up") return tones.profit;
  if (accent === "down") return tones.loss;
  return `hsl(${addressHue(address)}, 58%, 52%)`;
}

const styles = StyleSheet.create({
  id: { flexDirection: "row", alignItems: "center", gap: 12 },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, margin: -2 },
  avatar: { flex: 1, borderRadius: 18 },
  name: { gap: 2 },
  you: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  addr: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", gap: 12, marginTop: 4 },
  stat: { flex: 1 },
  statLabel: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.72 },
  statValue: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 32, fontVariant: ["tabular-nums"] },
});
