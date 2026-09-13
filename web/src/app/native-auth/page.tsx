import type { Metadata } from "next";
import { CapabilityPending } from "@/components/shell";

export const metadata: Metadata = { title: "Native sign-in" };

export default function Page() {
  return (
    <div className="container">
      <CapabilityPending eyebrow="Bridge" title="Native sign-in" dependency="native source — blocked; web auth is unaffected">
        <p>The deep-link bridge a native app would authenticate through. Masayume has no native build today, so this route documents the boundary instead of pretending to complete a handoff.</p>
      </CapabilityPending>
    </div>
  );
}
