"use client";

import { ArrowRightIcon, LoaderIcon, LockIcon, ShieldCheckIcon, UnplugIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ConnectButton } from "@/features/markets/wallet";
import { ROOM } from "./copy";
import type { RoomGate } from "./protocol";

/** The haloed mark that carries each onboarding state (reference `StateIcon`, L58–70). */
function StateIcon({ children, tone = "muted" }: { children: ReactNode; tone?: "vermilion" | "muted" }) {
  return (
    <div className="room-state-icon" data-tone={tone} aria-hidden>
      <span>{children}</span>
    </div>
  );
}

/** A locked speech bubble — "a private conversation" in one glyph (reference `RoomMark`). */
export function RoomMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.2 3.6h13.6A2.7 2.7 0 0 1 21.5 6.3v7A2.7 2.7 0 0 1 18.8 16H11l-4.3 3.5a.6.6 0 0 1-1-.47V16H5.2A2.7 2.7 0 0 1 2.5 13.3v-7A2.7 2.7 0 0 1 5.2 3.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="8.9" y="9.7" width="6.2" height="4.5" rx="1.1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.4 9.7V8.4a1.6 1.6 0 0 1 3.2 0v1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface RoomStatesProps {
  gate: Exclude<RoomGate, "joined">;
  onJoin: () => void;
  onBet?: () => void;
}

/**
 * Everything before the thread — the reference's onboarding states (L154–200).
 *
 * Each says the same three things: what this is, why you cannot speak yet, and what
 * would change that. The reference's `locked` copy is "Skin in the game unlocks the
 * room"; ours also names *where* the rule lives, because "the check is on-chain"
 * is the difference between a gate and a setting somebody could be asked to waive.
 */
export function RoomStates({ gate, onJoin, onBet }: RoomStatesProps) {
  if (gate === "unavailable") {
    return (
      <div className="room-state">
        <StateIcon>
          <UnplugIcon size={24} strokeWidth={1.8} />
        </StateIcon>
        <p className="room-state-title">{ROOM.states.unavailable.title}</p>
        <p className="room-state-body">{ROOM.states.unavailable.body}</p>
      </div>
    );
  }

  if (gate === "connect") {
    return (
      <div className="room-state">
        <StateIcon>
          <RoomMark size={26} />
        </StateIcon>
        <p className="room-state-title">{ROOM.states.connect.title}</p>
        <p className="room-state-body">{ROOM.states.connect.body}</p>
        <ConnectButton />
      </div>
    );
  }

  if (gate === "locked") {
    return (
      <div className="room-state">
        <StateIcon>
          <LockIcon size={24} strokeWidth={1.8} />
        </StateIcon>
        <p className="room-state-title">{ROOM.states.locked.title}</p>
        <p className="room-state-body">{ROOM.states.locked.body}</p>
        {onBet && (
          <button type="button" className="room-cta" onClick={onBet} data-cursor="hover">
            {ROOM.bet} <ArrowRightIcon size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="room-state">
      <StateIcon tone="vermilion">
        <ShieldCheckIcon size={26} strokeWidth={1.8} />
      </StateIcon>
      <p className="room-state-title">{ROOM.states.joinable.title}</p>
      <p className="room-state-body">{ROOM.states.joinable.body}</p>
      <button type="button" className="room-cta" onClick={onJoin} disabled={gate === "joining"} data-cursor="hover">
        {gate === "joining" ? (
          <>
            <LoaderIcon size={15} className="animate-spin" /> {ROOM.joining}
          </>
        ) : (
          ROOM.join
        )}
      </button>
    </div>
  );
}
