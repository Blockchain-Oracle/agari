import { Redirect } from "expo-router";

/** The app opens on Markets, as web's manifest start_url does. */
export default function Index() {
  return <Redirect href="/markets" />;
}
