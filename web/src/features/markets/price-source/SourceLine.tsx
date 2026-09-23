import { cn } from "@/lib/utils";
import type { SourceLabel } from "./source-label";
import "./source-line.css";

/**
 * A source label as a quiet line: the feed's own page opens in a new tab where one is pinned, plain text otherwise. The
 * caller gives it the container's own type (`pair-meta` in the hero head, the caption under a hub's figures).
 */
export function SourceLine({ label, className }: { label: SourceLabel | null; className?: string }) {
  if (!label) return null;
  return (
    <span className={cn("src-line", className)} data-provider={label.provider}>
      {label.href ? (
        <a href={label.href} target="_blank" rel="noreferrer" className="src-line-link" data-cursor="hover">
          {label.text}
          <span aria-hidden className="src-line-arrow">
            ↗
          </span>
        </a>
      ) : (
        label.text
      )}
    </span>
  );
}
