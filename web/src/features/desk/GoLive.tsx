"use client";

import { DESK_MINTS, type DeskMainnetSession } from "@agari/markets/desk";
import { useEffect, useState } from "react";
import { DESK } from "./copy";
import { GO_LIVE } from "./copy-controls";
import { pct, usd } from "./format";
import { loadLiveProgress, nextStage, resumeStage, saveLiveProgress, type LiveProgress, type LiveStage } from "./go-live";
import { ModePicker, type LiveMode } from "./ModePicker";
import { MoneySheet } from "./MoneySheet";
import type { DeskActions } from "./useDeskWrites";
import type { DeskView } from "./view";

type KitAddress = Parameters<DeskMainnetSession["setOperator"]>[0];
const STEPS: LiveStage[] = ["open-pending", "allow-pending", "mandate-pending", "deposit-pending"];
const STEP_COPY = { "open-pending": GO_LIVE.steps.open, "allow-pending": GO_LIVE.steps.allow, "mandate-pending": GO_LIVE.steps.attach, "deposit-pending": GO_LIVE.steps.deposit } as const;

/**
 * Go live (plan §5.4 step 04, §5.5): open the desk on Solana mainnet, allow the basket's companies, link the desk to
 * its record, put money in. A durable stage machine (`go-live.ts`): each step is written to this browser before its
 * confirmation, and on return the chain is read first so nothing is asked for twice.
 */
export function GoLive({ view, actions, liveMode, zone, nowSec }: { view: DeskView; actions: DeskActions; liveMode: LiveMode; zone: string | null; nowSec: number }) {
  const owner = actions.owner;
  const operator = view.wire.operator;
  const mandate = view.mandate;
  const [mode, setMode] = useState<LiveMode>(liveMode);
  const [progress, setProgress] = useState<LiveProgress | null>(null);
  const [stage, setStage] = useState<LiveStage | null>(null);
  const [money, setMoney] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { session, state } = actions;

  // Resume: what this browser saved, corrected by what the chain and the index say now.
  useEffect(() => {
    if (!owner) return;
    const saved = loadLiveProgress(owner);
    let live = true;
    const facts = async () => {
      const chain = session ? await session.readState(nowSec).catch(() => null) : null;
      const wanted = new Set((mandate?.targets.tokens ?? []).map((t) => DESK_MINTS[t.symbol] as string));
      const allowed = chain ? [...wanted].every((mint) => chain.tokens.some((t) => (t.mint as string) === mint && t.enabled)) : false;
      if (!live) return;
      setProgress(saved);
      setStage(resumeStage(saved?.stage ?? null, { deskExists: chain !== null, namesAllowed: chain !== null && wanted.size > 0 && allowed, rowIsLive: view.isLive }));
    };
    void facts();
    return () => {
      live = false;
    };
    // Only on mount and when the session appears: a poll must not reset a step in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, session]);

  const save = (next: Partial<LiveProgress> & { stage: LiveStage }) => {
    if (!owner || !operator) return;
    const merged: LiveProgress = { owner, operator, mode, openTx: null, allowTx: null, address: null, startedAtSec: nowSec, ...progress, ...next };
    setProgress(merged);
    setStage(merged.stage);
    saveLiveProgress(owner, merged);
  };

  if (!owner) return <p className="type-body text-ink-secondary">{DESK.studio.create.connect}</p>;
  if (!operator) return <p className="type-body dk-warn">{GO_LIVE.noOperator}</p>;
  if (actions.mainnet.kind === "unsupported") return <p className="type-body dk-warn">{GO_LIVE.unsupported(actions.mainnet.why)}</p>;
  if (!mandate || !session || stage === null) return <p className="type-body text-ink-secondary">{DESK.studio.read.waiting}</p>;

  const run = async () => {
    setProblem(null);
    if (stage === "open-pending") {
      save({ stage: "open-pending" });
      const landed = await actions.tx("open", (s) => s.openDesk({ operator: operator as unknown as KitAddress, perActionCapE6: mandate.perActionCapE6, dailyCapE6: mandate.dailyCapE6, maxPremiumBps: mandate.maxPremiumBps, mode }));
      if (!landed.ok) return setProblem(landed.reason);
      const chain = await session.readState(nowSec).catch(() => null);
      save({ stage: "allow-pending", openTx: landed.signature, address: chain?.address ?? null });
    } else if (stage === "allow-pending") {
      const landed = await actions.tx("allow", (s) => s.allowTokens(mandate.targets.tokens.map((t) => DESK_MINTS[t.symbol])));
      if (!landed.ok) return setProblem(landed.reason);
      save({ stage: "mandate-pending", allowTx: landed.signature });
    } else if (stage === "mandate-pending") {
      const address = progress?.address ?? (await session.readState(nowSec).catch(() => null))?.address ?? null;
      if (!address) return setProblem(DESK.studio.read.failed);
      const linked = await actions.recordMode(mode, { address, operator });
      if (!linked.ok) return setProblem(linked.reason);
      save({ stage: "deposit-pending", address });
    } else {
      setMoney(true);
    }
  };
  const busy = state.busy !== null;
  const current = STEPS.indexOf(stage);
  return (
    <div className="dk-card">
      <span className="dk-eyebrow" data-live="">{GO_LIVE.eyebrow}</span>
      <strong className="dk-holding-name">{GO_LIVE.title}</strong>
      <p className="type-caption text-ink-secondary">{GO_LIVE.body}</p>
      {stage === "open-pending" && <ModePicker value={mode} onChange={setMode} label={GO_LIVE.mode} />}
      <ol className="dk-rows" aria-label={GO_LIVE.title}>
        {STEPS.map((s, i) => {
          const c = STEP_COPY[s];
          const body = s === "open-pending" ? c.body : s === "allow-pending" ? (c as typeof GO_LIVE.steps.allow).body(mandate.targets.tokens.map((t) => t.symbol).join(", ")) : (c as { body: string }).body;
          return (
            <li key={s} className="dk-row" aria-current={i === current ? "step" : undefined}>
              <span className={i < current ? "text-ink-muted" : i === current ? "text-ink" : "text-ink-muted"}>
                <b>{String(i + 1).padStart(2, "0")} {c.title}</b>
                <br />
                <span className="type-caption">{typeof body === "function" ? body(usd(mandate.perActionCapE6, 0), usd(mandate.dailyCapE6, 0), pct(mandate.maxPremiumBps)) : body}</span>
              </span>
              <span className="dk-mono">{i < current ? "done" : ""}</span>
            </li>
          );
        })}
      </ol>
      {progress && progress.stage !== "open-pending" && <p className="type-caption text-ink-muted">{GO_LIVE.resume(STEP_COPY[stage].title)}</p>}
      <p className="type-caption text-ink-muted">{GO_LIVE.fees}</p>
      <div className="dk-card-actions">
        <button type="button" className="dk-control" data-tone="primary" disabled={busy} onClick={() => void run()}>{busy ? DESK.studio.read.signing : STEP_COPY[stage].button}</button>
        {problem && <span className="type-caption dk-warn">{problem}</span>}
      </div>
      {money && (
        <MoneySheet
          view={view}
          actions={actions}
          kind="deposit"
          zone={zone}
          nowSec={nowSec}
          onClose={() => {
            setMoney(false);
            if (state.phase === "done") saveLiveProgress(owner, null);
          }}
        />
      )}
    </div>
  );
}
