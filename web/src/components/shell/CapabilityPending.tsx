import Link from "next/link";

/** Where a pending surface sends the reader meanwhile: the live venue, never a blank page (D-083 nav honesty). */
export const CAPABILITY_NEXT = { label: "Make a call on the markets", href: "/markets" } as const;

/**
 * The honest state for a route whose capability is not connected yet.
 *
 * Loading and unavailable are valid product states; inventing odds, balances, fills,
 * opponents or settlements to fill a page is not. This says plainly what the surface will
 * do, what it is waiting on, and where the truth will come from — so a reviewer can tell a
 * pending capability from a broken one.
 */
export function CapabilityPending({
  eyebrow,
  title,
  children,
  dependency,
  nextAction = CAPABILITY_NEXT,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  /** The concrete thing this surface is waiting on — a program, service, or data source. */
  dependency: string;
  /** The way out while it waits; every deferred route keeps one (D-084). */
  nextAction?: { label: string; href: string };
}) {
  return (
    <section className="capability-pending">
      <p className="cp-eyebrow">{eyebrow}</p>
      <h1 className="cp-title">{title}</h1>
      <div className="cp-body">{children}</div>
      <p className="cp-meta">Not connected yet · waiting on {dependency}</p>
      <Link href={nextAction.href} className="cp-action">
        {nextAction.label} →
      </Link>
    </section>
  );
}
