import type { ReactNode } from "react";
import { Chevron } from "./Chevron";
import "./ledger-plate.css";

/** The plate's own disclosure row (reference page L318–329: "Creator earnings and recovery"), for controls that should not take a row in the money list. */
export function PlateDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="plate-rows lp-disclosure">
      <details className="group">
        <summary className="lp-disclosure-summary">
          {title}
          <span className="pool-chevron">
            <Chevron />
          </span>
        </summary>
        <div className="pb-4">{children}</div>
      </details>
    </div>
  );
}
