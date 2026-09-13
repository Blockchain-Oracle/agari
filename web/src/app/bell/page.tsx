import { redirect } from "next/navigation";

// The Bell ritual folded into the core /markets flow. The route stays as a redirect so lingering inbound links resolve instead of 404ing.
export default function Redirect() {
  redirect("/markets");
}
