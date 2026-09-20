"use client";

import { LockIcon, UnlockIcon } from "lucide-react";
import { useState } from "react";
import { ConnectButton } from "@/features/markets/wallet";
import { STRATEGIES } from "./copy";
import { money } from "./format";
import { strategyIdentity } from "./identity";
import { SEALED_BODY_MAX, SEALED_TITLE_MAX } from "./memory-protocol";
import type { StrategyWire } from "./protocol";
import { useSealedMemory } from "./useSealedMemory";
import "./strategies.css";

const M = STRATEGIES.memory;

interface MemoryMarketProps {
  strategies: readonly StrategyWire[];
  /** True when the connected wallet holds an on-chain subscription to the strategy. */
  subscribed: (strategyId: string) => boolean;
  decimals: number;
  symbol: string;
  /** Opens the copy drawer: subscribing is what buys the pass. */
  onSubscribe: (card: StrategyWire) => void;
  onSealed: () => void;
}

/**
 * The Memory Market (reference "Own what an agent has learned"): a creator seals what their agent has learned, and
 * a subscriber reads it. The pass is the on-chain subscription, whose fee `agari-strategy` pays to the creator, so
 * there is nothing to buy here that the chain does not already record. The catalogue carries a title and a length;
 * the words come only from the gated route, to the creator or a subscriber who signs for them.
 */
export function MemoryMarket({ strategies, subscribed, decimals, symbol, onSubscribe, onSealed }: MemoryMarketProps) {
  const memory = useSealedMemory();
  const sealed = strategies.filter((s) => s.memory !== null);
  const mine = strategies.filter((s) => s.creator === memory.address);
  return (
    <section className="mt-10 sm:mt-12">
      <div className="strat-rail-title mb-3 tracking-[0.34em] text-vermilion/80">{M.eyebrow}</div>
      <h2 className="strat-memory-h2">
        {M.title[0]}
        <br />
        <span className="text-ink/50">{M.title[1]}</span>
      </h2>
      <p className="type-caption mt-4 max-w-2xl text-ink-secondary">{M.lede}</p>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sealed.map((card) => {
          const holds = card.creator === memory.address || subscribed(card.strategyId);
          const state = memory.reads[card.strategyId] ?? { kind: "idle" };
          const fee = BigInt(card.feeBase);
          return (
            <article key={card.strategyId} className="strat-capsule">
              <div className="strat-capsule-icon">{state.kind === "open" ? <UnlockIcon aria-hidden="true" /> : <LockIcon aria-hidden="true" />}</div>
              <div className="strat-choice-title text-ink">{card.memory?.title}</div>
              <p className="strat-meta text-ink/60">{M.by(strategyIdentity(card).name)} · {M.length(card.memory?.chars ?? 0)}</p>
              {state.kind === "open" ? (
                <pre className="strat-drawer-body strat-capsule-body">{state.memory.body}</pre>
              ) : (
                <>
                  <p className="strat-meta text-ink/40">{fee > 0n ? M.pass(money(fee, decimals, symbol)) : M.passFree}</p>
                  {!memory.address ? (
                    <ConnectButton />
                  ) : holds && state.kind !== "locked" ? (
                    <button type="button" className="strat-confirm strat-confirm--live" disabled={state.kind === "busy"} onClick={() => void memory.read(card.strategyId)}>
                      {state.kind === "busy" ? M.reading : M.read}
                    </button>
                  ) : (
                    <button type="button" className="strat-confirm strat-confirm--live" onClick={() => onSubscribe(card)}>
                      {M.subscribe}
                    </button>
                  )}
                  {state.kind === "failed" && <p className="strat-meta text-warning">{state.why}</p>}
                </>
              )}
            </article>
          );
        })}
        {sealed.length === 0 && (
          <div className="strat-capsule-soon">
            <div className="strat-capsule-icon"><LockIcon aria-hidden="true" /></div>
            <div className="strat-choice-title text-ink/70">{M.emptyTitle}</div>
            <p className="strat-meta max-w-45 leading-relaxed text-ink/40">{M.emptyBody}</p>
          </div>
        )}
      </div>
      {mine.length > 0 && <SealForm strategies={mine} seal={memory.seal} onSealed={onSealed} />}
    </section>
  );
}

function SealForm({ strategies, seal, onSealed }: { strategies: readonly StrategyWire[]; seal: (strategyId: string, title: string, body: string) => Promise<string | null>; onSealed: () => void }) {
  const [strategyId, setStrategyId] = useState(strategies[0]?.strategyId ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ready = strategyId !== "" && title.trim().length > 0 && body.trim().length > 0;
  const submit = async () => {
    setBusy(true);
    const failure = await seal(strategyId, title.trim(), body);
    setBusy(false);
    setNote(failure ?? M.sealedNote);
    if (!failure) {
      setTitle("");
      setBody("");
      onSealed();
    }
  };
  return (
    <div className="mt-10 max-w-2xl space-y-3">
      <div className="desk-field-label">{M.sealHeading}</div>
      <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} className="strat-input text-ink" aria-label={M.sealHeading}>
        {strategies.map((s) => <option key={s.strategyId} value={s.strategyId}>#{s.strategyId} · {strategyIdentity(s).name}</option>)}
      </select>
      <input value={title} maxLength={SEALED_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder={M.titlePlaceholder} className="strat-input text-ink" />
      <textarea value={body} maxLength={SEALED_BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder={M.bodyPlaceholder} className="strat-input strat-textarea text-ink" />
      <button type="button" className={ready && !busy ? "strat-confirm strat-confirm--live" : "strat-confirm strat-confirm--dead"} disabled={!ready || busy} onClick={() => void submit()}>
        {busy ? M.sealing : M.seal}
      </button>
      {note && <p className="strat-meta text-ink/60" role="status">{note}</p>}
    </div>
  );
}
