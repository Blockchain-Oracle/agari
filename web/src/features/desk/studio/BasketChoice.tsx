"use client";

import { DESK_PRESETS, nameOf } from "@agari/core/desk";
import { BASKETS } from "@agari/core/market";
import { Blocks } from "lucide-react";
import { LogoStack, RadioCards, Sparkline, type RadioCardItem } from "@/components/ui/desk-kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { draftFromPreset, type StudioDraft } from "../draft";
import { pctSigned } from "../format";
import { basketLine, lineNumbers, type DeskMarks } from "../useDeskMarks";
import { STUDIO } from "./copy-studio";

const B = STUDIO.basket;
const OWN = "own";

/** The move across a line in basis points, integer arithmetic; null with fewer than two points. */
function moveBps(line: readonly bigint[]): number | null {
  const first = line[0];
  const last = line.at(-1);
  if (first === undefined || last === undefined || line.length < 2 || first === 0n) return null;
  return Number(((last - first) * 10_000n) / first);
}

/**
 * The five baskets as cards you can read at a glance (S22): the cluster mark, the ticker, every member's logo and
 * name, and the basket's last seven days drawn from the hourly marks. A sixth card starts your own mix.
 */
export function BasketChoice({ draft, setDraft, marks }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void; marks: DeskMarks | null }) {
  const items: RadioCardItem<string>[] = DESK_PRESETS.map((p) => {
    const basket = BASKETS[p.basket];
    const members = basket.members.map((m) => m.symbol);
    const line = basketLine(marks, p.basket);
    const move = moveBps(line);
    return {
      value: p.id,
      media: (
        <>
          <AssetDisc asset={p.basket} className="st-basket-disc" />
          <span className="st-basket-ticker">${p.basket}</span>
        </>
      ),
      title: p.name,
      body: (
        <span className="st-basket-members">
          <LogoStack symbols={members} names={members.map(nameOf)} size="sm" max={4} />
          <span>{members.length <= 3 ? members.map(nameOf).join(" · ") : B.members(members.length)}</span>
        </span>
      ),
      footer: (
        <>
          {line.length >= 2 ? <Sparkline values={lineNumbers(line)} width={92} height={26} /> : <span className="st-basket-noline">{B.noLine}</span>}
          <span className="st-basket-move" data-tone={move === null ? undefined : move > 0 ? "up" : move < 0 ? "down" : undefined}>
            {move === null ? "—" : pctSigned(move)}
          </span>
          <span className="st-basket-week">{B.week}</span>
        </>
      ),
    };
  });
  items.push({
    value: OWN,
    media: (
      <span className="st-own-icon" aria-hidden>
        <Blocks className="size-5" />
      </span>
    ),
    title: B.own.title,
    body: B.own.body,
  });

  const keep = (d: StudioDraft, next: StudioDraft): StudioDraft => ({ ...next, notes: d.notes, practiceCash: d.practiceCash, driftPct: d.driftPct, positionPct: d.positionPct, lossPct: d.lossPct, premiumPct: d.premiumPct, perAction: d.perAction, daily: d.daily, large: d.large, liveMode: d.liveMode });
  const pick = (value: string) => setDraft((d) => (value === OWN ? { ...d, preset: null } : keep(d, draftFromPreset(value))));
  return <RadioCards value={draft.preset ?? OWN} onChange={pick} items={items} label={B.presetsAria} className="st-baskets" />;
}
