import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerifyMac } from "@masayume/core/games";

/**
 * The one line of crypto the room holds: HMAC-SHA256 over the token's claims, compared in constant time.
 *
 * Everything that could be got subtly wrong — the claim order, the two clocks, the arena binding — is in
 * `@masayume/core/games`'s `verifyRoomToken`, which takes this as an argument. The web app mints with the
 * identical two lines over the identical payload builder, so the only thing that could drift between the
 * two processes is the secret itself, and a wrong secret fails every token loudly rather than one quietly.
 */
export function roomMac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Constant time, so a MAC cannot be discovered one byte at a time by measuring the refusal. */
export function roomMacVerifier(secret: string): VerifyMac {
  return (payload, mac) => {
    const expected = Buffer.from(roomMac(secret, payload));
    const given = Buffer.from(mac);
    return expected.length === given.length && timingSafeEqual(expected, given);
  };
}
