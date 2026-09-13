import { VAULT } from "./copy";

/** The one honest state a network without an EventVault can show: the layout stays, the words say what is missing. */
export function NotDeployedNote({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="type-body text-ink">{VAULT.notDeployed.why}</p>
      <p className="mt-1 type-caption text-ink-muted">{VAULT.notDeployed.how}</p>
    </div>
  );
}
