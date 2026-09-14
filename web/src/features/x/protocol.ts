import { messageSignatureSchema } from "@agari/core/auth";
import { addressSchema } from "@agari/core/types";
import type { XReceipt } from "@agari/core/x";
import type { XRelayHealth } from "@agari/db";
import { z } from "zod";

export const X_RECEIPTS_LIMIT = 30;

/** A base58 Solana wallet and its base58 ed25519 signature over the link text (D-010, D-012). */
const address = addressSchema;
const signature = messageSignatureSchema;

/** The wallet proves it owns the address over the exact link message the route rebuilds. */
export const xBindRequestSchema = z.object({ wallet: address, issuedAtMs: z.number().int().positive(), signature });
export const xUnlinkRequestSchema = xBindRequestSchema;
export type XBindRequest = z.infer<typeof xBindRequestSchema>;

/** Which X account routes to which wallet — the durable fact the relay acts on. */
export interface XBinding {
  authorId: string;
  handle: string | null;
  wallet: string;
  since: number;
}

/**
 * `GET /api/x/status`: the two facts the reference's card keeps apart — who is signed in
 * RIGHT HERE (the cookie) and which account actually routes to a wallet, on any device (the store).
 */
export interface XStatus {
  /** Operational evidence is separate from OAuth configuration and wallet binding. */
  relay?: XRelayHealth | null;
  configured: boolean;
  /** Variable names that would connect the rail; empty when configured. */
  missing: string[];
  storeConfigured: boolean;
  signedIn: boolean;
  session: { authorId: string; handle: string | null } | null;
  /** The live route for the signed-in account, else for the wallet asked about. */
  binding: XBinding | null;
  /** The executor wallet an EXECUTOR grant names; null until the owner configures it. */
  executor: string | null;
  /** The brand handle a mention addresses. */
  handle: string;
}

export interface XReceiptsFeed {
  configured: boolean;
  receipts: XReceipt[];
}

/** Where an OAuth bounce lands; the reference carries the result in `?x=` and a reason in `?x_reason=`. */
export const X_RETURN_PARAM = "x";
export const X_REASON_PARAM = "x_reason";
export const X_DEFAULT_RETURN = "/trade-from-x";
