import { Skeleton } from "@/components/ui/skeleton";
import "./entry.css";

/** The desk page while it loads, in the cockpit's own shape: the header, the value chart, the tabs, the cards. */
export function DeskSkeleton() {
  return (
    <div className="dk-page container" role="status" aria-busy="true" aria-label="Loading">
      <div className="en-skel">
        <Skeleton className="h-3 w-56" />
        <div className="en-skel-head">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-44" />
        <Skeleton className="en-skel-chart" />
        <div className="en-skel-tabs">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-20" />
          ))}
        </div>
        <div className="en-skel-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
