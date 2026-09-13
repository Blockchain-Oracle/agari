import { redirect } from "next/navigation";

// The beta trading surface was promoted to the main market flow. Anyone holding the old link lands on the real thing.
export default function Redirect() {
  redirect("/markets");
}
