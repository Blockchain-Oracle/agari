"use client";

import { luckyDrawMessage, mapLuckyDraw } from "@masayume/core/games";
import type { Hex } from "@masayume/core/types";
import { useEffect, useState } from "react";
import { keccak256 } from "viem";
import type { LuckyDealWire } from "./lucky-wire";

/**
 * "Check it", run in this browser and nowhere else: the server seed must hash to the commitment the
 * reels started on, and the HMAC over both seeds — replayed with WebCrypto over core's own message
 * layout — must map to the very draw on screen. A deal that fails either is said to fail, and the card
 * tells the player not to place it. What this does NOT check is the Window: that came from a rule over
 * a hashed candidate set, and the card says so in as many words.
 */
export type LuckyCheck = "checking" | "verified" | "mismatch" | "unavailable";

/** Over a fresh ArrayBuffer, which is what WebCrypto's `BufferSource` wants — not a view over anything shared. */
function hexBytes(hex: Hex): Uint8Array<ArrayBuffer> {
  const pairs = hex.slice(2).match(/../g) ?? [];
  const out = new Uint8Array(new ArrayBuffer(pairs.length));
  pairs.forEach((pair, i) => {
    out[i] = Number.parseInt(pair, 16);
  });
  return out;
}

async function replay(deal: LuckyDealWire): Promise<LuckyCheck> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "unavailable";
  if (keccak256(deal.serverSeed).toLowerCase() !== deal.commitment.toLowerCase()) return "mismatch";
  const message = luckyDrawMessage({ clientSeed: deal.clientSeed, wallet: deal.wallet, nonce: deal.nonce, policyVersion: deal.policyVersion });
  const key = await subtle.importKey("raw", hexBytes(deal.serverSeed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await subtle.sign("HMAC", key, hexBytes(message)));
  const draw = mapLuckyDraw(digest, { assets: deal.assets, multipliers: deal.multipliers });
  const same = draw.asset === deal.draw.asset && draw.side === deal.draw.side && draw.multiplier === deal.draw.multiplier;
  return same ? "verified" : "mismatch";
}

export function useLuckyCheck(deal: LuckyDealWire | null): LuckyCheck {
  const [state, setState] = useState<LuckyCheck>("checking");
  useEffect(() => {
    if (!deal) return;
    let alive = true;
    setState("checking");
    replay(deal)
      .then((result) => {
        if (alive) setState(result);
      })
      .catch(() => {
        if (alive) setState("mismatch");
      });
    return () => {
      alive = false;
    };
  }, [deal]);
  return state;
}
