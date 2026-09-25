import { Redirect } from "expo-router";
import { storage } from "~/lib/storage";

/**
 * First launch opens the app's own onboarding (brand intro, four pages, connect or look around); every launch after
 * lands on /markets. The flag is local to this installation.
 */
export default function Index() {
  return <Redirect href={storage.getBoolean("agari.mobile.onboarded.v1") ? "/markets" : "/onboarding"} />;
}
