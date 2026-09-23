import type { Address } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SOCIAL } from "@/features/social/copy";
import { readSocialToken } from "@/features/social/session-store";
import { useFollows, useFollowToggle } from "@/features/social/useFollows";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, haptic } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

/**
 * web's `FollowButton` (features/social/FollowButton.tsx): vermilion to follow, an outline once following. The first
 * press in an hour asks the wallet to sign web's social-session text (`useFollowToggle`); every other press is a plain
 * request. Your own profile says so instead of offering a button.
 */
export function FollowButton({ wallet }: { wallet: Address }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const mine = useFollows(address);
  const toggle = useFollowToggle();

  if (address === wallet) {
    return <Text style={[TYPE.caption, styles.self, { color: color.inkMuted }]}>{SOCIAL.self}</Text>;
  }

  const following = mine.data?.following.includes(wallet) ?? false;
  const unavailable = mine.data?.configured === false;
  const pending = toggle.pending === wallet;
  const short = shortHex(wallet);
  const label = !address
    ? SOCIAL.connect
    : pending
      ? readSocialToken(address)
        ? SOCIAL.saving
        : SOCIAL.working
      : following
        ? SOCIAL.following
        : SOCIAL.follow;

  const press = async () => {
    if (!address) {
      router.push("/connect");
      return;
    }
    const landed = await toggle.setFollow(wallet, !following);
    if (landed) haptic.success();
  };

  return (
    <View style={styles.wrap}>
      <Button
        label={label}
        variant={following && !pending ? "outline" : "primary"}
        size="sm"
        block={false}
        icon={following && !pending ? { ios: "checkmark", android: "check" } : { ios: "person.badge.plus", android: "person_add" }}
        loading={pending}
        disabled={unavailable || (address !== null && mine.data === null)}
        accessibilityHint={address ? (following ? SOCIAL.unfollowLabel(short) : SOCIAL.followLabel(short)) : undefined}
        onPress={() => void press()}
      />
      {unavailable ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{SOCIAL.unavailable}</Text> : null}
      {toggle.error ? (
        <Text style={[TYPE.caption, { color: color.loss }]} accessibilityRole="alert">
          {toggle.error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, alignItems: "flex-start" },
  self: { paddingVertical: 12 },
});
