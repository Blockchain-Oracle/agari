import { GAMES } from "./copy";

/**
 * A section that has no writer yet.
 *
 * `CapabilityPending` is the whole-route version of this and owns an `h1`; a section inside a page
 * that already has one needs the same honesty at a lower heading level. The rule is identical: say
 * what the surface will do, and name the concrete thing it waits on, so a reviewer can tell a
 * pending capability from a broken one.
 */
export function PendingPlate({ title, body, dependency }: { title: string; body: string; dependency: string }) {
  return (
    <div className="gm-plate gm-pending">
      <p className="gm-plate-title">{title}</p>
      <p className="gm-plate-body">{body}</p>
      <p className="gm-plate-meta">{GAMES.card.waitingOn(dependency)}</p>
    </div>
  );
}
