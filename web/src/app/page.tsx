import type { Metadata } from "next";
import { LANDING, LandingPage } from "@/features/landing";

export const metadata: Metadata = {
  title: { absolute: LANDING.meta.title },
  description: LANDING.meta.description,
};

/** `/` is the landing (L-11, D-093): a static shell with three client islands, so nothing here depends on the request. */
export default function Home() {
  return <LandingPage />;
}
