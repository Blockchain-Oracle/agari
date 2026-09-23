"use client";

import { DESK } from "./copy";
import type { StudioDraft } from "./draft";
import { BasketChoice } from "./studio/BasketChoice";
import { WeightEditor } from "./studio/WeightEditor";
import { useDeskMarks } from "./useDeskMarks";

const B = DESK.studio.basket;

/**
 * Step 01, the basket (plan §5.4, redesigned in S22): the five baskets as cards with their companies' logos and their
 * last week, a sixth card for a mix of your own, then the weights as sliders drawn as a bar and a ring. Picking a
 * basket fills the weights; editing a weight keeps the basket's name only while the mix still matches it.
 */
export function BasketPicker({ draft, setDraft }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void }) {
  const marks = useDeskMarks();
  return (
    <div className="flex flex-col gap-8">
      <section className="st-block" aria-label={B.presets}>
        <span className="st-label">{B.presets}</span>
        <BasketChoice draft={draft} setDraft={setDraft} marks={marks} />
      </section>
      <WeightEditor draft={draft} setDraft={setDraft} />
    </div>
  );
}
