import type { BoundRow } from "./bounds";

/**
 * §02 on a house reserve: the tunables the deployed program carries, read from the reserve account itself.
 *
 * A supplier's only honest guide to what they are taking on is what the contract will and will not do, so these
 * are the program's own numbers — never a projected return (`00-plan.md` §Never a fake APY).
 */
export function ReserveBounds({ rows, risk }: { rows: readonly BoundRow[]; risk: string }) {
  return (
    <div className="ea-bounds">
      <dl className="ea-bound-rows">
        {rows.map((row) => (
          <div key={row.label} className="ea-bound">
            <dt className="ea-k ea-bound-k">{row.label}</dt>
            <dd className="ea-bound-v">
              <span className="ea-bound-n">{row.value}</span>
              <span className="ea-bound-note">{row.note}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="ea-risk">{risk}</p>
    </div>
  );
}
