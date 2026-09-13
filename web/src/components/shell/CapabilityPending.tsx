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
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  /** The concrete thing this surface is waiting on — a contract, service, or data source. */
  dependency: string;
}) {
  return (
    <section className="capability-pending">
      <p className="cp-eyebrow">{eyebrow}</p>
      <h1 className="cp-title">{title}</h1>
      <div className="cp-body">{children}</div>
      <p className="cp-meta">Not connected yet · waiting on {dependency}</p>
    </section>
  );
}
