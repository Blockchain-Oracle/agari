import { Skeleton } from "@/components/ui/skeleton";
import "./decision.css";

/** The decision page while it loads, in its own shape: the hero, then the stepper's first sections. */
export function DecisionSkeleton() {
  return (
    <div className="dk-page container dc-page" role="status" aria-busy="true" aria-label="Loading">
      <div className="dc-skel">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="dc-skel-hero" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dc-skel-step">
            <Skeleton />
            <Skeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
