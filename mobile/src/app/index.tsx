import { Redirect } from "expo-router";
import { storage } from "~/lib/storage";

/** The walkthrough is local to this installation; returning users open the live market. */
export default function Index() {
  return <Redirect href={storage.getBoolean("agari.mobile.onboarded.v1") ? "/markets" : "/welcome"} />;
}
