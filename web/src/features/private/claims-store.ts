"use client";

import { PRIVATE_BACKUP_KIND, PRIVATE_BACKUP_VERSION, privateTicketSchema, type PrivateTicket } from "@masayume/core/private";
import { useCallback, useEffect, useRef, useState } from "react";

/** The reference kept its tickets under `yosuku_private_bet_tickets`; ours live under this key, newest first. */
const KEY = "masayume.private.claims";
/** Rows kept beyond this are the settled ones; an open claim is never evicted — it is the only record of that money. */
const CAP = 60;
const REFRESH_MS = 4_000;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Every well-formed row, and only those: one bad row (a hand-edited backup) must never hide the rest. */
function parseRows(raw: string | null): PrivateTicket[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      const result = privateTicketSchema.safeParse(row);
      return result.success ? [result.data as PrivateTicket] : [];
    });
  } catch {
    return [];
  }
}

export function loadPrivateTickets(owner?: string | null): PrivateTicket[] {
  const all = parseRows(readRaw());
  return owner ? all.filter((t) => t.claim.owner.toLowerCase() === owner.toLowerCase()) : all;
}

export function savePrivateTickets(tickets: PrivateTicket[]): void {
  if (typeof window === "undefined") return;
  const open = tickets.filter((t) => t.status === "open");
  const rest = tickets.filter((t) => t.status !== "open").slice(0, Math.max(0, CAP - open.length));
  const kept = tickets.filter((t) => open.includes(t) || rest.includes(t));
  try {
    window.localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // storage unavailable — the ticket still exists on the desk's reply, and the caller shows it
  }
}

/** One claim per slot: a cash-out replaces the row it updates, an open adds a new one at the top. */
export function upsertPrivateTicket(ticket: PrivateTicket): void {
  const all = loadPrivateTickets();
  const rest = all.filter((t) => t.claim.slotId.toLowerCase() !== ticket.claim.slotId.toLowerCase());
  savePrivateTickets([ticket, ...rest]);
}

/** A portable copy of every claim this browser holds. Plain JSON on purpose: it has to survive a lost laptop and this app going away. */
export function exportPrivateClaims(owner?: string | null): string {
  return JSON.stringify({ kind: PRIVATE_BACKUP_KIND, version: PRIVATE_BACKUP_VERSION, exportedAt: Date.now(), claims: loadPrivateTickets(owner) }, null, 2);
}

/**
 * Merge a backup back in. Existing claims win, so restoring an old file cannot roll a cashed-out position back
 * to "open"; a row that does not parse is skipped and counted, never stored. Returns how many were added and skipped.
 */
export function importPrivateClaims(raw: string): { added: number; skipped: number } {
  const parsed = JSON.parse(raw) as { kind?: string; claims?: unknown[] };
  if (parsed?.kind !== PRIVATE_BACKUP_KIND) throw new Error("not a Masayume claims file");
  const incoming = Array.isArray(parsed.claims) ? parsed.claims : [];
  const existing = loadPrivateTickets();
  const seen = new Set(existing.map((t) => t.claim.slotId.toLowerCase()));
  let skipped = 0;
  const added: PrivateTicket[] = [];
  for (const row of incoming) {
    const result = privateTicketSchema.safeParse(row);
    if (!result.success) {
      skipped += 1;
      continue;
    }
    const ticket = result.data as PrivateTicket;
    if (seen.has(ticket.claim.slotId.toLowerCase())) continue;
    seen.add(ticket.claim.slotId.toLowerCase());
    added.push(ticket);
  }
  if (added.length > 0) savePrivateTickets([...added, ...existing]);
  return { added: added.length, skipped };
}

/** The owner's claims, re-read on a storage event and every few seconds — the reference's cadence — but re-parsed only when the stored text changed. */
export function usePrivateTickets(owner: string | null): { tickets: PrivateTicket[]; refresh: () => void } {
  const [tickets, setTickets] = useState<PrivateTicket[]>([]);
  const last = useRef<string | null>(null);
  const refresh = useCallback(() => {
    const raw = readRaw();
    const key = `${owner?.toLowerCase() ?? ""}:${raw ?? ""}`;
    if (key === last.current) return;
    last.current = key;
    setTickets(owner ? parseRows(raw).filter((t) => t.claim.owner.toLowerCase() === owner.toLowerCase()) : []);
  }, [owner]);
  useEffect(() => {
    last.current = null;
    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);
  return { tickets, refresh };
}
