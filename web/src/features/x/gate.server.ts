import { X_LINK_SIGNATURE_TTL_MS, xLinkMessage, xUnlinkMessage } from "@masayume/core/x";
import { xLinkByAuthor, xLinkByWallet, type XLinkRecord } from "@masayume/db";
import { cookies } from "next/headers";
import { verifyMessage } from "viem";
import { readXConfig, type XConfig } from "./config.server";
import type { XBinding } from "./protocol";
import { readSession, X_SESSION_COOKIE, type XSession } from "./session.server";

/**
 * The X rail's authority — server only. The authorId comes from the SIGNED session, never the
 * client, so a caller can only ever link their own handle; the wallet proves itself by signing
 * the exact message the route rebuilds.
 */
export type XGate = { configured: false; missing: string[] } | { configured: true; config: XConfig; session: XSession | null };

export async function readXGate(origin: string): Promise<XGate> {
  const reading = readXConfig(origin);
  if (!reading.configured) return reading;
  const jar = await cookies();
  return { configured: true, config: reading.config, session: readSession(reading.config.sessionSecret, jar.get(X_SESSION_COOKIE)?.value) };
}

export function toBinding(link: XLinkRecord): XBinding {
  return { authorId: link.authorId, handle: link.handle, wallet: link.wallet, since: link.createdAtMs };
}

/** The live route for a signed-in account, else for the wallet asked about, else null. */
export async function findBinding(session: XSession | null, wallet: string | null): Promise<XBinding | null> {
  const byAuthor = session ? await xLinkByAuthor(session.authorId) : null;
  if (byAuthor) return toBinding(byAuthor);
  const byWallet = wallet ? await xLinkByWallet(wallet) : null;
  return byWallet ? toBinding(byWallet) : null;
}

export function signatureFresh(issuedAtMs: number, nowMs: number): boolean {
  return Math.abs(nowMs - issuedAtMs) <= X_LINK_SIGNATURE_TTL_MS;
}

export async function verifyLinkSignature(kind: "link" | "unlink", authorId: string, wallet: string, issuedAtMs: number, signature: string): Promise<boolean> {
  try {
    const message = kind === "link" ? xLinkMessage(authorId, wallet, issuedAtMs) : xUnlinkMessage(authorId, wallet, issuedAtMs);
    return await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
  } catch {
    return false;
  }
}
