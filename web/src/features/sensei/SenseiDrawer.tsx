"use client";

import type { EventMarket } from "@masayume/core/types";
import { formatClock, formatOracleRaw } from "@masayume/core/units";
import { useEffect, useRef, useState } from "react";
import MasayumeMark from "@/components/shell/MasayumeMark";
import { cn } from "@/lib/utils";
import { CardSpark } from "../markets/lanes/CardSpark";
import { ORACLE_SCALE } from "../markets/hero/units";
import { chipsFor, SENSEI_STARTERS, SENSEI_UI } from "./copy";
import { SenseiTradeCards } from "./SenseiTradeCards";
import { Typewriter } from "./Typewriter";
import type { SenseiChat } from "./useSenseiChat";
import type { SenseiReading } from "./useSenseiSnapshot";

interface SenseiDrawerProps {
  open: boolean;
  onClose: () => void;
  chat: SenseiChat;
  reading: SenseiReading;
  markets: readonly EventMarket[];
  nowMs: number;
  secsLeft: number;
  urgent: boolean;
}

const usd0 = (raw: bigint): string => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;

/** The pinned strip that anchors every reply below it: price, drift, time left, tape. */
function SenseiMeter({ reading, secsLeft, urgent }: { reading: SenseiReading; secsLeft: number; urgent: boolean }) {
  const { latestRaw, drift, points, nearest } = reading;
  return (
    <div className={cn("sensei-meter", `sd-dir-${drift?.direction ?? "flat"}`, urgent && "urgent")}>
      <div className="sm-read">
        <span className="sm-spot">{latestRaw === null ? SENSEI_UI.reading : usd0(latestRaw)}</span>
        {drift && (
          <>
            <span className="sm-tri" aria-hidden />
            <span className="sm-drift">
              {drift.direction === "flat"
                ? SENSEI_UI.flat
                : `${drift.moveRaw > 0n ? "+" : "−"}${usd0(drift.moveRaw < 0n ? -drift.moveRaw : drift.moveRaw)}`}
            </span>
            {/* The span actually held, never the span asked for — see computeDrift. */}
            <span className="sm-window">{SENSEI_UI.minute(drift.spanMin)}</span>
          </>
        )}
        <span className="sm-spacer" />
        {nearest && (
          <span className="sm-time">
            <span className="sm-time-num">{formatClock(secsLeft)}</span>
            <span className="sm-time-lab">{SENSEI_UI.left}</span>
          </span>
        )}
      </div>
      <div className="sm-chart-wrap sm-chart-inset">
        <div className="mc-spark">
          <CardSpark points={points} openingRaw={nearest?.openingPriceRaw ?? null} />
        </div>
      </div>
    </div>
  );
}

/**
 * Sensei's side drawer — ported from `reference/yosuku/components/SenseiDock.tsx` L251–334.
 *
 * Everything the reference shows is here, over readings the page already holds:
 * the meter, the tape, the thread with its typewriter reveal, contextual follow-up
 * chips, starters on the first turn, and the trade cards once a read exists.
 */
export function SenseiDrawer({ open, onClose, chat, reading, markets, nowMs, secsLeft, urgent }: SenseiDrawerProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const toBottom = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.loading, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const last = chat.messages[chat.messages.length - 1];
  // A failure notice is not a read: it earns neither follow-up chips ("Why?" about a
  // configuration error) nor the trade cards.
  const showChips = !chat.loading && chat.messages.length > 1 && last?.role === "assistant" && !last.failed && chat.typingIndex === -1;
  const hasRead = chat.messages.some((message, index) => index > 0 && message.role === "assistant" && !message.failed);

  return (
    <>
      <div className={cn("sensei-drawer-scrim", open && "show")} onClick={onClose} aria-hidden={!open} />
      <aside className={cn("sensei-drawer", open && "open")} role="dialog" aria-label={SENSEI_UI.title} aria-modal={open} aria-hidden={!open}>
        <header className="sensei-drawer-head">
          <div>
            <div className="sd-eyebrow">{SENSEI_UI.eyebrow}</div>
            <div className="sd-title">
              {SENSEI_UI.title} <span className="sd-beta">{SENSEI_UI.beta}</span>
            </div>
          </div>
          <div className="sd-head-right">
            <button className="sd-close" onClick={onClose} aria-label={SENSEI_UI.close} data-cursor="hover">
              ✕
            </button>
          </div>
        </header>

        <SenseiMeter reading={reading} secsLeft={secsLeft} urgent={urgent} />

        <div ref={scrollRef} className="sensei-drawer-msgs">
          {chat.messages.map((message, index) => (
            <div key={index} className={cn("sd-row", message.role)}>
              {message.role === "assistant" && (
                <span className="sd-ava" aria-hidden>
                  <MasayumeMark className="sd-ava-mark" />
                </span>
              )}
              <div className={cn("sd-msg", message.role)}>
                {message.role === "assistant" && index === chat.typingIndex ? (
                  <Typewriter text={message.content} onDone={chat.doneTyping} onType={toBottom} />
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          {chat.loading && (
            <div className="sd-row assistant">
              <span className="sd-ava" aria-hidden>
                <MasayumeMark className="sd-ava-mark" />
              </span>
              <div className="sd-msg assistant">
                <span className="sensei-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}
          {showChips && (
            <div className="sd-chips">
              {chipsFor(last.content).map((chip) => (
                <button key={chip} className="sd-chip" onClick={() => void chat.send(chip)} data-cursor="hover">
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The reference's rule: the cards appear once Sensei has actually given a
            read, never pinned open by default. Action follows the recommendation. */}
        {hasRead && (
          <SenseiTradeCards markets={markets} snapshotMarkets={reading.snapshot?.markets ?? []} nowMs={nowMs} onAct={onClose} />
        )}

        {chat.messages.length === 1 && (
          <div className="sensei-drawer-starters">
            {SENSEI_STARTERS.map((starter) => (
              <button key={starter} onClick={() => void chat.send(starter)} data-cursor="hover" className="sd-starter">
                {starter}
              </button>
            ))}
          </div>
        )}

        <form
          className="sensei-drawer-input"
          onSubmit={(event) => {
            event.preventDefault();
            void chat.send(input);
            setInput("");
          }}
        >
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={SENSEI_UI.placeholder} aria-label={SENSEI_UI.placeholder} />
          <button type="submit" disabled={chat.loading || !input.trim()} data-cursor="hover">
            {SENSEI_UI.send}
          </button>
        </form>
      </aside>
    </>
  );
}
