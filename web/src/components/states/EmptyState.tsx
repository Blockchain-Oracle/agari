import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NextAction = { label: string; href: string } | { label: string; onClick: () => void };

interface EmptyStateProps {
  why: string;
  nextAction?: NextAction;
  className?: string;
}

/** Says why it is empty and names the next action — never a blank panel. */
export function EmptyState({ why, nextAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-hairline bg-surface-1 p-4", className)}>
      <p className="type-body text-ink">{why}</p>
      {nextAction &&
        ("href" in nextAction ? (
          <Button variant="secondary" size="sm" render={<Link href={nextAction.href} />}>
            {nextAction.label}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={nextAction.onClick}>
            {nextAction.label}
          </Button>
        ))}
    </div>
  );
}
