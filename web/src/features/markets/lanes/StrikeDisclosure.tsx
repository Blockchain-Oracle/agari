import { MARKETS } from "@/lib/copy";

/** FR-6's strike-0 filter, disclosed with a count — one filter, never a silent omission. */
export function StrikeDisclosure({ count }: { count: number }) {
  if (count === 0) return null;
  return <p className="type-caption text-ink-muted">{MARKETS.fixedStrikeHidden(count)}</p>;
}
