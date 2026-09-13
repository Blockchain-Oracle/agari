import { redirect } from "next/navigation";

// The liquidity page is now the default tab on /earn. Old links and docs keep working.
export default function Redirect() {
  redirect("/earn");
}
