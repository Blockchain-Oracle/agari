import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FixtureProps {
  label: string;
  className?: string;
  children: ReactNode;
}

/** One labeled specimen card on a fixture page. */
export function Fixture({ label, className, children }: FixtureProps) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-4", className)}>
      <h3 className="type-label-micro text-ink-muted">{label}</h3>
      {children}
    </section>
  );
}

export function FixtureGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
