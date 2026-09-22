"use client";

import { nameOf, presetById, type DeskMandate } from "@agari/core/desk";
import { cn } from "@/lib/utils";
import { DESK } from "./copy";
import { draftTargets, practiceCashE6, sideCardLine, type StudioDraft } from "./draft";
import { pct, usd } from "./format";

const S = DESK.studio.side;

/** The studio's side card (plan §5.4): it follows every edit. "$1,000 → $400 OpenAI · $400 Anthropic · $200 cash". */
export function StudioSide({ draft, mandate, read }: { draft: StudioDraft; mandate: DeskMandate | null; read: "done" | "stale" | "none" }) {
  const targets = draftTargets(draft);
  const preset = draft.preset ? presetById(draft.preset) : null;
  const cash = practiceCashE6(draft);
  return (
    <aside className="dk-panel dk-studio-side" aria-label={S.kicker}>
      <span className="dk-panel-title">{S.kicker}</span>
      <h3 className="dk-holding-name">{preset ? S.preset(preset.name) : S.own}</h3>
      <div className="dk-side-bar" aria-hidden>
        {targets.tokens.map((t, i) => (
          <span key={t.symbol} style={{ width: `${t.weightBps / 100}%`, background: `color-mix(in srgb, var(--color-accent) ${90 - i * 9}%, var(--color-surface-1))` }} />
        ))}
      </div>
      <div className="dk-side-weights">
        {targets.tokens.map((t) => (
          <span key={t.symbol}>
            {nameOf(t.symbol)} <b>{pct(t.weightBps)}</b>
          </span>
        ))}
        <span>
          {DESK.studio.basket.cash} <b>{pct(targets.cashBps)}</b>
        </span>
      </div>
      <p className="type-caption text-ink-secondary">{sideCardLine(targets, cash)}</p>
      <div className="dk-rows">
        <div className="dk-row"><span>{S.perAction}</span><b>{mandate ? usd(mandate.perActionCapE6, 0) : "—"}</b></div>
        <div className="dk-row"><span>{S.daily}</span><b>{mandate ? usd(mandate.dailyCapE6, 0) : "—"}</b></div>
        <div className="dk-row"><span>{S.mode}</span><b>{DESK.modes.practice}</b></div>
        <div className="dk-row"><span>{S.read}</span><b className={cn(read === "done" && "text-profit")}>{read === "done" ? S.readDone : read === "stale" ? S.readStale : S.readNone}</b></div>
      </div>
      <p className="type-caption text-ink-muted">{S.approach}</p>
    </aside>
  );
}
