import { redirect } from "next/navigation";
import { MARKETS_PATH } from "@/lib/routes";

/** The landing page lands in Epic 4; until then the root is the markets loop. */
export default function Home() {
  redirect(MARKETS_PATH);
}
