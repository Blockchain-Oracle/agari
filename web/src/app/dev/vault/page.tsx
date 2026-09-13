import type { Metadata } from "next";
import { VAULT } from "@/features/vault";
import { VaultFixtures } from "./VaultFixtures";

export const metadata: Metadata = { title: `Fixtures · ${VAULT.devTitle}` };

export default function VaultFixturesPage() {
  return <VaultFixtures />;
}
