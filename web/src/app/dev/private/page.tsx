import type { Metadata } from "next";
import { PRIVATE } from "@/features/private";
import { PrivateFixtures } from "./PrivateFixtures";

export const metadata: Metadata = { title: `Fixtures · ${PRIVATE.devTitle}` };

export default function PrivateFixturesPage() {
  return <PrivateFixtures />;
}
