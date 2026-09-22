/**
 * The texts an owner signs for the desk, over `core/auth` (`messageBytes`, `verifySignedMessage`): a mandate version,
 * an answer to an approval request, a "check now". Written to be READ: each names what the signature allows, the desk
 * it belongs to, and the network, so a devnet signature is never a mainnet one and a mandate signature never approves
 * an action.
 */
import { networkLine, SIGNED_MESSAGE_BRAND } from "../auth/signed-message";
import type { Cluster } from "../constants/chain";
import type { Hash32 } from "../types/primitives";

export interface DeskMandateTextInput {
  owner: string;
  cluster: Cluster;
  version: number;
  /** `mandateFingerprint(mandate)`. */
  fingerprint: Hash32;
  /** ISO-8601, second precision. */
  signedAtIso: string;
}

/** "This is what I want held." One version, one fingerprint, one owner. */
export function deskMandateText(i: DeskMandateTextInput): string {
  return [
    `${SIGNED_MESSAGE_BRAND} desk mandate`,
    "",
    "This signature sets what my desk holds and the limits it must stay inside. It does not approve any single trade and does not move any money.",
    "",
    `Owner: ${i.owner}`,
    `Mandate version: ${i.version}`,
    `Fingerprint: ${i.fingerprint}`,
    `Signed at: ${i.signedAtIso}`,
    networkLine(i.cluster),
  ].join("\n");
}

export interface DeskApprovalTextInput {
  owner: string;
  cluster: Cluster;
  /** The record the desk asked with. */
  decisionSeq: number;
  /** `hashRecord` of that record: the signature approves exactly this request. */
  decisionHash: Hash32;
  answer: "approve" | "decline";
  /** What the desk asked, in its own words ("buy $140 of OpenAI"). */
  summary: string;
  expiresAtIso: string;
}

/** "Do it" or "Don't", bound to one request by its fingerprint and expiry. */
export function deskApprovalText(i: DeskApprovalTextInput): string {
  const verb = i.answer === "approve" ? "I approve this one action" : "I decline this one action";
  return [
    `${SIGNED_MESSAGE_BRAND} desk approval`,
    "",
    `${verb}: ${i.summary}.`,
    i.answer === "approve" ? "The desk may carry it out once, inside my limits, before it expires. Nothing else is approved." : "The desk will not carry it out.",
    "",
    `Owner: ${i.owner}`,
    `Decision: ${i.decisionSeq}`,
    `Fingerprint: ${i.decisionHash}`,
    `Expires at: ${i.expiresAtIso}`,
    networkLine(i.cluster),
  ].join("\n");
}

export interface DeskCheckNowTextInput {
  owner: string;
  cluster: Cluster;
  requestedAtIso: string;
}

/** "Look now." Throttled server-side to one every ten minutes (plan §5.8). */
export function deskCheckNowText(i: DeskCheckNowTextInput): string {
  return [
    `${SIGNED_MESSAGE_BRAND} desk check`,
    "",
    "Please check my desk now. This does not approve any trade and does not move any money.",
    "",
    `Owner: ${i.owner}`,
    `Requested at: ${i.requestedAtIso}`,
    networkLine(i.cluster),
  ].join("\n");
}
