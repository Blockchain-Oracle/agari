import { redirect } from "next/navigation";

// Deep links to a single market resolve into the market browser, which keys every window by marketId.
export default function Redirect() {
  redirect("/markets");
}
