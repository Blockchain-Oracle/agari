"use client";

import { PAGER } from "@/lib/copy";
import type { PagerState } from "@/lib/use-pager";
import { cn } from "@/lib/utils";

/**
 * Prev · "1–8 of 23" · Next, in the reference's mono micro type, under a paged list. Renders nothing
 * while the list fits on one page — a pager over eight rows is furniture.
 */
export function Pager<T>({ pager, className }: { pager: PagerState<T>; className?: string }) {
  if (pager.total <= pager.pageSize) return null;
  return (
    <nav className={cn("pager", className)} aria-label={PAGER.aria}>
      <button type="button" className="pager-button" onClick={pager.prev} disabled={!pager.canPrev} data-cursor="hover">
        {PAGER.prev}
      </button>
      <span className="pager-range numbers" aria-live="polite">
        {PAGER.range(pager.from, pager.to, pager.total)}
      </span>
      <button type="button" className="pager-button" onClick={pager.next} disabled={!pager.canNext} data-cursor="hover">
        {PAGER.next}
      </button>
    </nav>
  );
}
