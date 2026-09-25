import { Redirect } from "expo-router";
import { storage } from "~/lib/storage";

/**
 * web opens on the markets page and, on a first visit, lays the "Welcome to Agari" tutorial over it: the app lands on
 * /markets with /welcome pushed on top as a modal (the walkthrough is local to this installation).
 */
export default function Index() {
  return <Redirect href={storage.getBoolean("agari.mobile.onboarded.v1") ? "/markets" : "/markets?welcome=1"} />;
}
