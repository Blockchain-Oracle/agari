import { isAddress } from "@agari/core/types";
import { router, useLocalSearchParams } from "expo-router";
import { EmptyState, Screen } from "~/components/kit";
import { ProfileScreen } from "~/features/profile/ProfileScreen";

/**
 * `/u/<address>` — web's app/u/[address]/page.tsx. Base58 is case-sensitive (D-010): an address that isn't exactly
 * one is no one's profile, and the screen says so.
 */
export default function ProfileRoute() {
  const { address = "" } = useLocalSearchParams<{ address: string }>();
  if (!isAddress(address)) {
    return (
      <Screen title="Trader">
        <EmptyState
          why="That isn't a wallet address."
          detail="Profiles open from the leaderboard, a take, the Room or an activity row."
          action={{ label: "Open the leaderboard", onPress: () => router.replace("/leaderboard") }}
        />
      </Screen>
    );
  }
  return <ProfileScreen address={address} />;
}
