import type { Metadata } from "next";
import { GamesHub } from "@/features/games";

export const metadata: Metadata = { title: "Games" };

export default function Page() {
  return <GamesHub />;
}
