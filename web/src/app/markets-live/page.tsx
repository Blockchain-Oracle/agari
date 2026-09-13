import { redirect } from "next/navigation";

// Retired: /markets is the one market flow now. Forwarding costs nothing and keeps bookmarks working.
export default function Redirect() {
  redirect("/markets");
}
