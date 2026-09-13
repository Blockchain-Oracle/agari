"use client";

import { useEffect, useState } from "react";
import { TICKET } from "@/lib/copy";
import { Ticket } from "./Ticket";
import type { TicketSelection } from "./types";

/** Tailwind's `lg` — the reference docks the ticket at `lg:static` and slides it over the page below. */
const RAIL_QUERY = "(min-width: 64rem)";

function useHasRail(): boolean {
  const [hasRail, setHasRail] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(RAIL_QUERY);
    const sync = () => setHasRail(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return hasRail;
}

/**
 * Docked beside the chart where there is room for it; the reference's right-edge drawer where there is not
 * (`Ticket624Drawer.tsx` L768–777: a backdrop, a full-height panel at `max-w-[440px]`, `translate-x-full`
 * → `translate-x-0` over 300 ms, `role="dialog"`).
 *
 * The drawer has no trigger of its own. Every tap that selects a Window — the hero's UP/DOWN, a card's
 * side buttons, the card body, a word-board Yes/No, the Room's "bet" — bumps the selection's session id,
 * and that is what opens it. It used to open only when the *side* changed, so a card tapped without a
 * side, or tapped again on the same side, did nothing; the reference opens on `!!ticket`, side or not.
 */
export function TicketDock({ selection }: { selection: TicketSelection }) {
  const hasRail = useHasRail();
  const [open, setOpen] = useState(false);
  const { sessionId } = selection;

  useEffect(() => {
    if (!hasRail && sessionId > 0) setOpen(true);
  }, [hasRail, sessionId]);

  // Escape closes the drawer, as every dialog in the reference does. The rail is persistent and never closes.
  useEffect(() => {
    if (!open || hasRail) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasRail]);

  if (hasRail) {
    return (
      <div className="mh-rail">
        <Ticket selection={selection} />
      </div>
    );
  }

  const close = () => setOpen(false);
  return (
    <>
      {open && <div className="tk-drawer-backdrop" onClick={close} aria-hidden="true" />}
      <div className={`tk-drawer${open ? " tk-drawer--open" : ""}`} role="dialog" aria-label={TICKET.title} aria-hidden={!open}>
        {open && <Ticket selection={selection} drawer={{ onClose: close }} />}
      </div>
    </>
  );
}
