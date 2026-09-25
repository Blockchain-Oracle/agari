import { isAddress } from "@agari/core/types";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ProfileScreen } from "~/features/profile/ProfileScreen";
import { marketsWithNote, NOTE_KIND } from "@/lib/routes";

/**
 * `/u/<address>` — web's app/u/[address]/page.tsx. Base58 is case-sensitive (D-010): an address that isn't exactly one
 * is no one's profile, and web's not-found sends it to the markets with the "moved" note, so the app does too.
 */
export default function ProfileRoute() {
  const { address = "" } = useLocalSearchParams<{ address: string }>();
  if (!isAddress(address)) return <Redirect href={marketsWithNote(NOTE_KIND.moved) as never} />;
  return <ProfileScreen address={address} />;
}
