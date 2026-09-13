"use client";

import { isOk } from "@masayume/core/schemas";
import type { MarketId } from "@masayume/core/types";
import { usePositions } from "@masayume/markets/react";
import { useCallback, useEffect, useState } from "react";
import { useSignMessage } from "wagmi";
import { useWalletSession } from "@/lib/wallet-session";
import { ROOM_ERRORS } from "./copy";
import { type RoomComment, type RoomGate, roomJoinMessage } from "./protocol";
import { clearRoomToken, readRoomToken, writeRoomToken } from "./room-session";

/** The reference polls its thread every 9 s (`useCommentRoom.ts` L37). */
const POLL_MS = 9_000;

export interface Room {
  gate: RoomGate;
  comments: RoomComment[];
  busy: boolean;
  error: string | null;
  join: () => Promise<void>;
  post: (body: string) => Promise<void>;
}

/**
 * The Room's gate machine — ported from `reference/yosuku/lib/sui/useCommentRoom.ts`.
 *
 *   unavailable  no social store configured on this deployment
 *   connect      no wallet
 *   locked       wallet, but no position on this Window — cannot speak
 *   joinable     has a position, not yet joined → one signature
 *   joining      signature in flight
 *   joined       member: thread and composer, polled live
 *
 * The reference runs two identities: the login wallet gates the position, and a
 * separate Ed25519 delegate does all the messaging, because its messaging SDK
 * rejects zkLogin's signature scheme. That whole apparatus exists to work around a
 * constraint we do not have — an ordinary EVM `personal_sign` is exactly what the
 * server can verify — so there is one identity here, and the wallet that holds the
 * position is the wallet that speaks.
 *
 * The reference's `alsoTry` is gone with it: it exists because its ticket silently
 * rolls a bet onto the next round, leaving the room pinned to a round you did not
 * bet. Our ticket does not roll, so the Room is always about the Window you opened.
 *
 * One signature per hour, not per opening: the join token is remembered per wallet and
 * market (`room-session.ts`), so closing the sheet and opening it again lands on
 * `joined` with the thread, and the wallet is only asked again once the token has aged out.
 */
export function useRoom(marketId: MarketId | null, open: boolean): Room {
  const { address } = useWalletSession();
  const { signMessageAsync } = useSignMessage();
  // The same read the server will make, made here so the sheet can say "you need a
  // position" *before* asking for a signature that would only be refused. This is
  // an affordance, never the gate: the authority is the server's own check.
  const positions = usePositions(open ? address : null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  // The registry's answer — the same one the server gives at join, and the one a boost, a private bet or a
  // Trading Balance bet can only ever get, since none of them leave tokens in the wallet.
  const [seat, setSeat] = useState<boolean | null>(null);
  useEffect(() => {
    if (!open || !address || !marketId) return;
    let alive = true;
    void fetch(`/api/room/bet?marketId=${encodeURIComponent(marketId)}&address=${encodeURIComponent(address)}`)
      .then((response) => response.json() as Promise<{ hasBet?: boolean | null }>)
      .then((body) => {
        if (alive) setSeat(body.hasBet ?? null);
      })
      .catch(() => {
        if (alive) setSeat(null);
      });
    return () => {
      alive = false;
    };
  }, [open, address, marketId]);

  // A remembered session opens the Room already joined: the token the last join minted, if it is
  // still inside its hour.
  const [token, setToken] = useState<string | null>(() => (address && marketId ? readRoomToken(address, marketId) : null));
  const [gate, setGate] = useState<RoomGate>(() => (token ? "joined" : "connect"));
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joined = token !== null;

  useEffect(() => {
    if (!open || configured !== null) return;
    let alive = true;
    void fetch("/api/room/status")
      .then((response) => response.json() as Promise<{ configured?: boolean }>)
      .then((body) => {
        if (alive) setConfigured(body.configured === true);
      })
      .catch(() => {
        if (alive) setConfigured(false);
      });
    return () => {
      alive = false;
    };
  }, [open, configured]);

  // A token is bound to one wallet and one market; changing either swaps it for that pair's own
  // remembered token, or none.
  useEffect(() => {
    const remembered = address && marketId ? readRoomToken(address, marketId) : null;
    setToken(remembered);
    setComments([]);
    setError(null);
    if (remembered) setGate("joined");
  }, [marketId, address]);

  // The resting gate, derived rather than stored — only `joining` and `joined` are
  // states this hook holds, and both are set by `join`.
  useEffect(() => {
    if (joined || gate === "joining") return;
    if (configured === false) {
      setGate("unavailable");
      return;
    }
    if (!address) {
      setGate("connect");
      return;
    }
    // A position reading that has not landed is not an absence of position; hold
    // `joinable` until it says otherwise rather than flashing "you need a bet".
    const holds = positions && isOk(positions) ? positions.value.some((position) => position.marketId === marketId) : true;
    setGate(seat === true || holds ? "joinable" : "locked");
  }, [configured, address, positions, marketId, joined, gate, seat]);

  const load = useCallback(
    async (current: string) => {
      if (!marketId) return;
      const url = `/api/room?marketId=${encodeURIComponent(marketId)}&token=${encodeURIComponent(current)}`;
      const response = await fetch(url);
      if (response.status === 401) {
        // The session aged out mid-read. Forget it and fall back to joinable rather than
        // showing a thread that is quietly no longer being refreshed.
        if (address) clearRoomToken(address, marketId);
        setToken(null);
        setGate("joinable");
        setError(ROOM_ERRORS.notJoined);
        return;
      }
      const body = (await response.json()) as { comments?: RoomComment[]; error?: string };
      if (response.ok && body.comments) setComments(body.comments);
    },
    [marketId, address],
  );

  useEffect(() => {
    if (gate !== "joined" || !open || !token) return;
    void load(token);
    const id = setInterval(() => void load(token), POLL_MS);
    return () => clearInterval(id);
  }, [gate, open, token, load]);

  const join = useCallback(async () => {
    if (!marketId || !address) return;
    setError(null);
    setGate("joining");
    try {
      const issuedAtMs = Date.now();
      const signature = await signMessageAsync({ message: roomJoinMessage(marketId, address, issuedAtMs) });
      const response = await fetch("/api/room/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marketId, address, issuedAtMs, signature }),
      });
      const body = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !body.token) {
        // 503 is the deployment having no store; 403 is a real answer about this
        // wallet. They are different states and must not both read as "locked".
        setGate(response.status === 503 ? "unavailable" : response.status === 403 ? "locked" : "joinable");
        setError(body.error ?? ROOM_ERRORS.badRequest);
        return;
      }
      writeRoomToken(address, marketId, body.token, issuedAtMs);
      setToken(body.token);
      setGate("joined");
      await load(body.token);
    } catch (cause) {
      // A rejected signature prompt is a choice, not a failure — say nothing and
      // leave the door open.
      const rejected = /reject|denied|user cancel/i.test(String((cause as Error)?.message ?? ""));
      setGate("joinable");
      if (!rejected) setError(String((cause as Error)?.message ?? "").slice(0, 200));
    }
  }, [marketId, address, signMessageAsync, load]);

  const post = useCallback(
    async (body: string) => {
      if (!marketId || !token) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/room", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ marketId, token, body }),
        });
        const payload = (await response.json()) as { comment?: RoomComment; error?: string };
        if (!response.ok || !payload.comment) {
          setError(payload.error ?? ROOM_ERRORS.postFailed);
          return;
        }
        // Append the server's own row rather than a local echo, so what is on screen
        // is what was actually stored.
        setComments((prior) => [...prior, payload.comment!]);
      } catch {
        setError(ROOM_ERRORS.postFailed);
      } finally {
        setBusy(false);
      }
    },
    [marketId, token],
  );

  return { gate, comments, busy, error, join, post };
}
