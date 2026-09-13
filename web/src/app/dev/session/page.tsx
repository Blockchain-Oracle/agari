import type { Metadata } from "next";
import { SESSION } from "@/features/session";
import { SessionFixtures } from "./SessionFixtures";

export const metadata: Metadata = { title: `Fixtures · ${SESSION.dev.title}` };

export default function SessionFixturesPage() {
  return <SessionFixtures />;
}
