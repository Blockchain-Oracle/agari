import { HERO } from "@/lib/copy";

/** Names the settlement basis the chart and the model read (FR-7): the UI never hides which price decides. */
export function PriceSourceNote() {
  return <p className="type-caption text-ink-muted">{HERO.source}</p>;
}
