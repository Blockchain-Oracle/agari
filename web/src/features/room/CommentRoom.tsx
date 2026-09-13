"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LockIcon, SendIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { addressHue } from "@/lib/address-hue";
import { ROOM } from "./copy";
import { ROOM_BODY_MAX, type RoomComment, type RoomGate } from "./protocol";
import { RoomMark, RoomStates } from "./RoomStates";

interface CommentRoomProps {
  /** The call this Room is about, e.g. "BTC holds above $77,027? · 5m". */
  callLabel: string;
  gate: RoomGate;
  comments: RoomComment[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onJoin: () => void;
  onPost: (body: string) => void;
  /** Jump the reader to placing a bet, which is what unlocks the Room. */
  onBet?: () => void;
}

const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

/** The reference's own `timeAgo` (L26–34). */
function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/**
 * The Room's sheet — ported from `reference/yosuku/components/CommentRoom.tsx`.
 *
 * Two deliberate departures from the source, both about telling the truth:
 *
 *  - **It follows the theme.** The reference pins `data-theme="dark"` on the panel,
 *    the same dark-island treatment `/reels` had before the user's 2026-09-01
 *    ruling. A surface that does not flip is a defect, not a style.
 *  - **It does not claim encryption.** The reference's header badge reads "Bettors
 *    only · Encrypted", which is true of it: its messages are E2E-encrypted through
 *    Seal, and its own server cannot read them. Ours are stored in the clear in
 *    Postgres and the server can read them, so the badge says only what holds, and
 *    the composer says plainly where the words go.
 *
 * As with the Toast and the Tutorial, the Base UI primitive stays and takes the
 * reference's presentation — it brings the focus trap, the labelled dialog role and
 * inert background that the reference re-implements only partly.
 */
export function CommentRoom({ callLabel, gate, comments, busy, error, onClose, onJoin, onPost, onBet }: CommentRoomProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gate === "joined" && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length, gate]);

  const send = () => {
    // Collapse runs of whitespace, as the reference does, so a wall of newlines
    // cannot be used to shout.
    const text = draft.replace(/\s+/g, " ").trim().slice(0, ROOM_BODY_MAX);
    if (!text || busy) return;
    onPost(text);
    setDraft("");
  };

  const remaining = ROOM_BODY_MAX - draft.length;

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="room-scrim" />
        <Dialog.Popup ref={sheetRef} initialFocus={sheetRef} className="room-sheet">
          <div className="room-hairline" aria-hidden />

          <div className="room-head">
            <span className="room-mark" aria-hidden>
              <RoomMark size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="room-title">{callLabel}</Dialog.Title>
              <div className="room-badge">
                <LockIcon size={9} strokeWidth={2.4} /> {ROOM.qualifier}
              </div>
            </div>
            <Dialog.Close className="room-close" aria-label={ROOM.close} data-cursor="hover">
              <XIcon size={16} />
            </Dialog.Close>
          </div>

          {gate !== "joined" ? (
            <RoomStates gate={gate} onJoin={onJoin} onBet={onBet} />
          ) : (
            <>
              <div ref={listRef} className="room-thread">
                {comments.length === 0 && <p className="room-empty">{ROOM.empty}</p>}
                {comments.map((comment) => (
                  <div key={comment.id} className="room-line" data-mine={comment.mine}>
                    <span className="room-avatar" style={{ "--room-hue": addressHue(comment.author) } as CSSProperties} aria-hidden>
                      {comment.author.slice(2, 4).toUpperCase()}
                    </span>
                    <div className="room-bubble">
                      <div className="room-meta">
                        <span>{comment.mine ? "you" : shortAddress(comment.author)}</span>
                        <span>{timeAgo(comment.createdAtMs)}</span>
                      </div>
                      <p className="room-body">{comment.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="room-error">{error}</p>}

              <form
                className="room-compose"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, ROOM_BODY_MAX))}
                  placeholder={ROOM.compose}
                  aria-label={ROOM.compose}
                  maxLength={ROOM_BODY_MAX}
                />
                <span className="room-count" data-low={remaining <= 40} aria-hidden>
                  {remaining}
                </span>
                <button type="submit" className="room-send" disabled={busy || draft.trim().length === 0} aria-label={busy ? ROOM.sending : ROOM.send}>
                  <SendIcon size={15} />
                </button>
              </form>
            </>
          )}

          {gate !== "joined" && error && <p className="room-error">{error}</p>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
