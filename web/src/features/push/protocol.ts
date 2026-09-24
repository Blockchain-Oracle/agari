import { messageSignatureSchema, networkLine, SIGNED_MESSAGE_BRAND } from "@agari/core/auth";
import { DEFAULT_CLUSTER } from "@agari/core/constants";
import { addressSchema } from "@agari/core/types";
import { z } from "zod";
import type { ActivityKind } from "@/features/activity/protocol";

/**
 * Phone push (S26.4): the wire between the app and `/api/push/*`. The phone signs one message to register, gets back a
 * device secret, and presents that secret to change what it hears or to stop. The words of each notification are
 * the in-tab lifecycle notifications' own (`notificationOf`), so a push can never say something the app would not.
 */

export const PUSH_KINDS = ["fills", "results", "payouts"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/** Which inbox kinds each switch covers. A take is someone's words, not news about you: never pushed. */
export const PUSH_KIND_OF: Record<ActivityKind, PushKind | null> = {
  fill: "fills",
  "resting-filled": "fills",
  copied: "fills",
  "settled-win": "results",
  "settled-loss": "results",
  voided: "results",
  claimable: "payouts",
  "paid-automatically": "payouts",
  take: null,
};

/** A registration signature is only good for a few minutes, so a captured one cannot be replayed. */
export const PUSH_SIGNATURE_TTL_MS = 5 * 60_000;

/** The exact text the wallet signs to let this phone be told about it. Same fields → same string on both sides. */
export function pushRegisterMessage(address: string, expoToken: string, issuedAtMs: number): string {
  return [
    `${SIGNED_MESSAGE_BRAND} — notifications on this phone`,
    "",
    `Wallet: ${address}`,
    networkLine(DEFAULT_CLUSTER),
    `Device: ${expoToken}`,
    `Issued: ${new Date(issuedAtMs).toISOString()}`,
    "",
    "Signing lets Agari notify this phone when your calls fill, settle or pay out. It is not a transaction, it moves no funds, and it costs nothing.",
  ].join("\n");
}

const expoTokenSchema = z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,200}\]$/);
const kindsSchema = z.array(z.enum(PUSH_KINDS)).max(PUSH_KINDS.length);
/** The device secret the server hands back: 32 random bytes, base64url. */
const secretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const pushRegisterSchema = z.object({
  address: addressSchema,
  expoToken: expoTokenSchema,
  platform: z.enum(["ios", "android"]),
  kinds: kindsSchema,
  issuedAtMs: z.number().int().positive(),
  signature: messageSignatureSchema,
});

/** `kinds: null` turns this install off. */
export const pushUpdateSchema = z.object({
  expoToken: expoTokenSchema,
  secret: secretSchema,
  kinds: kindsSchema.nullable(),
});

export type PushRegisterRequest = z.infer<typeof pushRegisterSchema>;
export type PushUpdateRequest = z.infer<typeof pushUpdateSchema>;

export interface PushRegistration {
  wallet: string;
  kinds: PushKind[];
  /** Present on a fresh registration only; the phone keeps it in its keychain. */
  secret?: string;
}

/** What a notification carries for the app to open: an app path, never a URL. */
export interface PushData {
  path: string;
  kind: ActivityKind;
  itemId: string;
}

export const PUSH_ERRORS = {
  unavailable: "Notifications are not available right now.",
  badRequest: "That request was not understood.",
  staleSignature: "That signature has expired. Try again.",
  badSignature: "The wallet signature did not match.",
  unknownDevice: "This phone is not registered. Turn notifications on again.",
  tooFast: "Too many requests. Wait a moment.",
} as const;
