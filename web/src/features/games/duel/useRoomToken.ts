"use client";

import { ROOM_TOKEN_TTL_MS, roomAuthMessage } from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { DUEL } from "./copy";
import type { GameKey } from "./useGameKey";

/**
 * The duel room's credential: the browser key's signature, turned into a token this browser renews on
 * its own. The wallet is never asked.
 *
 * Flicky's room asks nothing before the entry — a bare `hello(address)` — and lets the chain vouch for
 * the address when the duel is created. This is the same rule with a signature behind it: the game key
 * signs a message that claims the connected wallet, silently, the moment the wallet and the key both
 * exist; the entry transaction later names that key on chain, and from then on the room checks a
 * socket's key against the arena's own record before it admits it to a seat (`handlers.ts`).
 *
 * **The token survives a reload, in `sessionStorage` and nowhere else.** A re-mint is free now, but a
 * resumed token spares a round trip on the screen people refresh most. It is a bearer token for one room,
 * one wallet, one key, one arena and one chain, for fifteen minutes: presenting it lets a holder queue,
 * reveal a seed and relay a "deciding" cue as that wallet. It signs nothing, moves nothing and authorises
 * no transaction. It does not go near `localStorage`: the storage is per tab and dies with the tab.
 *
 * **Renewal happens before the token dies, not after.** The session behind the signature lasts twelve
 * hours; inside it, renewal needs no signature at all.
 *
 * **What is configured is asked, never assumed.** The GET says whether this deployment has an arena and
 * a room before anything is signed, and hands back the chain and arena so the message this browser's key
 * signs is built by core's own builder.
 */

const ENDPOINT = "/api/games/room-token";
/** Renew this long before expiry: enough for a slow round trip, short enough to stay one token. */
const RENEW_LEAD_MS = 90_000;
/** One token per wallet, so switching accounts in a tab cannot resume the previous one's seat. */
const STORE_KEY = (wallet: string) => `masayume.room.${wallet.toLowerCase()}`;
/** Below this a stored token is not worth resuming: it would expire mid-handshake. */
const RESUME_FLOOR_MS = 20_000;

interface RoomTarget {
  chainId: number;
  arena: Address;
  url: string;
}

export type RoomAuth =
  /** Asked and answered: this deployment has no arena, or no room to reach it through. */
  | { kind: "unavailable"; why: string }
  | { kind: "asking" }
  | { kind: "connect" }
  /** The key is signing and the mint is in flight — no prompt, a moment. */
  | { kind: "opening" }
  | { kind: "ready"; token: string; url: string; wallet: Address }
  /** The server refused the key's claim. Carries what to say and leaves the door open. */
  | { kind: "refused"; why: string };

export interface RoomTokenSession {
  auth: RoomAuth;
  authorize: () => Promise<void>;
  target: RoomTarget | null;
}

interface Grant {
  token: string;
  expiresAtMs: number;
  sessionEndsAtMs: number;
  url: string | null;
  /** The key that signed for it, so a token is never resumed for a key this browser no longer holds. */
  key?: string;
}

/** Storage that is simply absent in a private window or a server render, and must never throw here. */
function readGrant(wallet: Address, key: Address): Grant | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORE_KEY(wallet));
    if (!raw) return null;
    const grant = JSON.parse(raw) as Grant;
    if (typeof grant?.token !== "string" || typeof grant.expiresAtMs !== "number") return null;
    if (grant.key?.toLowerCase() !== key.toLowerCase()) return null;
    return grant.expiresAtMs - Date.now() > RESUME_FLOOR_MS ? grant : null;
  } catch {
    return null;
  }
}

function writeGrant(wallet: Address, grant: Grant | null): void {
  try {
    if (grant) globalThis.sessionStorage?.setItem(STORE_KEY(wallet), JSON.stringify(grant));
    else globalThis.sessionStorage?.removeItem(STORE_KEY(wallet));
  } catch {
    // A browser refusing storage costs a re-mint per reload; it does not cost the duel.
  }
}

export function useRoomToken(key: GameKey | null): RoomTokenSession {
  const { address, isConnected } = useWalletSession();
  const [target, setTarget] = useState<RoomTarget | null | undefined>(undefined);
  const [auth, setAuth] = useState<RoomAuth>({ kind: "asking" });
  const grantRef = useRef<Grant | null>(null);
  const renewRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while a mint is in flight, so two effects cannot mint twice for one key. */
  const mintingRef = useRef(false);

  // One question, once: what this deployment actually has.
  useEffect(() => {
    let alive = true;
    void fetch(ENDPOINT)
      .then((response) => response.json() as Promise<{ chainId: number | null; arena: string | null; url: string | null }>)
      .then((body) => {
        if (!alive) return;
        setTarget(body.chainId && body.arena && body.url ? { chainId: body.chainId, arena: body.arena as Address, url: body.url } : null);
      })
      .catch(() => {
        if (alive) setTarget(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** A token belongs to one wallet and one key. Changing either throws it away rather than reusing it. */
  useEffect(() => {
    grantRef.current = null;
    if (renewRef.current) clearTimeout(renewRef.current);
  }, [address, key?.address]);

  const scheduleRenew = useCallback((grant: Grant, wallet: Address) => {
    if (renewRef.current) clearTimeout(renewRef.current);
    const inMs = Math.max(5_000, Math.min(grant.expiresAtMs - Date.now() - RENEW_LEAD_MS, ROOM_TOKEN_TTL_MS));
    renewRef.current = setTimeout(() => {
      void fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: grant.token }) })
        .then(async (response) => {
          if (!response.ok) {
            // The session behind the signature has ended; the key signs again, on its own, below.
            grantRef.current = null;
            writeGrant(wallet, null);
            setAuth({ kind: "asking" });
            return;
          }
          const next = { ...((await response.json()) as Grant), key: grant.key };
          grantRef.current = next;
          writeGrant(wallet, next);
          if (next.url) setAuth({ kind: "ready", token: next.token, url: next.url, wallet });
          scheduleRenew(next, wallet);
        })
        .catch(() => {
          // A failed renewal is not a failed session: try again inside the token's remaining life.
          scheduleRenew({ ...grant, expiresAtMs: Date.now() + RENEW_LEAD_MS }, wallet);
        });
    }, inMs);
  }, []);

  useEffect(() => () => void (renewRef.current && clearTimeout(renewRef.current)), []);

  const authorize = useCallback(async () => {
    if (!address || !target || !key || mintingRef.current) return;
    mintingRef.current = true;
    setAuth({ kind: "opening" });
    try {
      const issuedAtMs = Date.now();
      const signature = await key.signMessage(roomAuthMessage({ wallet: address, key: key.address, chainId: target.chainId, arena: target.arena, issuedAtMs }));
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address, key: key.address, issuedAtMs, signature }),
      });
      const body = (await response.json()) as Grant & { error?: string };
      if (!response.ok || !body.token) {
        setAuth({ kind: "refused", why: body.error ?? DUEL.auth.refused });
        return;
      }
      const grant = { ...body, key: key.address };
      grantRef.current = grant;
      writeGrant(address, grant);
      setAuth({ kind: "ready", token: grant.token, url: grant.url ?? target.url, wallet: address });
      scheduleRenew(grant, address);
    } catch (cause) {
      setAuth({ kind: "refused", why: String((cause as Error)?.message ?? "").slice(0, 200) });
    } finally {
      mintingRef.current = false;
    }
  }, [address, target, key, scheduleRenew]);

  /**
   * The resting state, derived — and the mint, automatic.
   *
   * With a wallet, a key and a room to reach, there is nothing to ask the player: the key signs, the
   * server answers, the socket opens. A stored token for this very key is resumed first, so a reload
   * costs no round trip. Only `refused` waits, because retrying a refusal without a change is noise.
   */
  useEffect(() => {
    if (auth.kind === "opening" || auth.kind === "refused") return;
    const settle = (next: RoomAuth) => setAuth((held) => (held.kind === next.kind ? held : next));
    if (target === undefined) return settle({ kind: "asking" });
    if (target === null) return settle({ kind: "unavailable", why: DUEL.auth.unavailable });
    if (!isConnected || !address) return settle({ kind: "connect" });
    if (auth.kind === "ready" && auth.wallet === address) return;
    if (!key) return settle({ kind: "asking" });
    const stored = readGrant(address, key.address);
    if (stored) {
      grantRef.current = stored;
      scheduleRenew(stored, address);
      setAuth({ kind: "ready", token: stored.token, url: stored.url ?? target.url, wallet: address });
      return;
    }
    void authorize();
  }, [target, isConnected, address, key, auth, authorize, scheduleRenew]);

  const retry = useCallback(async () => {
    setAuth({ kind: "asking" });
    await authorize();
  }, [authorize]);

  return { auth, authorize: retry, target: target ?? null };
}
