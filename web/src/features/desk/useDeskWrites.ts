"use client";

import { deskApprovalText, deskCheckNowText, deskMandateText, mandateFingerprint, mandateToWire, type DeskMandate, type DeskMode } from "@agari/core/desk";
import type { Signature } from "@agari/core/types";
import { createDeskMainnetSession, DeskSendError, type DeskMainnetSession, type DeskWriteResult as SessionWriteResult } from "@agari/markets/desk";
import { useCallback, useMemo, useRef, useState } from "react";
import { signText, useOwnerWallet } from "@/lib/wallet-session";
import { useMainnetWalletSession, type MainnetWalletSession } from "@/providers/wallet/mainnet-signer";
import { DESK_ERRORS_UI } from "./copy-controls";
import { DESK_CLUSTER, deskModeText, deskOwnerActionText, deskShareText, type ApprovalWire, type OwnerActionKind } from "./protocol";
import { useInvalidateDesk } from "./useDesk";

/**
 * Every desk write, one at a time, in the `useVaultWrite` shape: a signed message to a route (practice desk, an
 * approval, check now, sharing, the mode, a request) or one mainnet transaction through `createDeskMainnetSession`
 * (open, allow, deposit, withdraw, pause, resume, mode, revoke). The phase is reported so a card can say "Confirm in
 * your wallet…" then "Sent. Waiting for Solana mainnet…"; nothing is ever re-sent, and every desk read is refetched
 * after a write lands.
 */
export type DeskBusy = "mandate" | "approval" | "check-now" | "share" | "mode" | "action" | "open" | "allow" | "deposit" | "withdraw" | "pause" | "unpause" | "set-mode" | "set-limits" | "revoke" | null;
export type DeskPhase = "idle" | "signing" | "sending" | "confirming" | "done" | "failed";
export interface DeskWriteState {
  busy: DeskBusy;
  phase: DeskPhase;
  signature: Signature | null;
  problem: string | null;
}
export type DeskWriteResult = { ok: true; signature: Signature | null; body: Record<string, unknown> } | { ok: false; reason: string; status: number | null };

const IDLE: DeskWriteState = { busy: null, phase: "idle", signature: null, problem: null };
const CANCELLED = /reject|cancel|denied|declined|abort/i;

function reasonOf(error: unknown): string {
  if (error instanceof DeskSendError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  return CANCELLED.test(message) || (error instanceof Error && error.name === "AbortError") ? DESK_ERRORS_UI.signCancelled : message || DESK_ERRORS_UI.unknown;
}

export function useDeskWrites(key: string | null) {
  const wallet = useOwnerWallet();
  const mainnet: MainnetWalletSession = useMainnetWalletSession();
  const invalidate = useInvalidateDesk();
  const [state, setState] = useState<DeskWriteState>(IDLE);
  const inFlight = useRef(false);
  const owner = wallet?.address ?? null;
  const session = useMemo<DeskMainnetSession | null>(() => (mainnet.kind === "ready" ? createDeskMainnetSession({ signer: mainnet.signer, rpcUrl: mainnet.rpcUrl }) : null), [mainnet]);

  const post = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<DeskWriteResult> => {
      const response = await fetch(`/api/desk/${encodeURIComponent(key ?? owner ?? "")}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const answer = ((await response.json().catch(() => null)) ?? {}) as Record<string, unknown>;
      if (!response.ok) return { ok: false, reason: typeof answer.error === "string" ? answer.error : DESK_ERRORS_UI.unknown, status: response.status };
      return { ok: true, signature: null, body: answer };
    },
    [key, owner],
  );

  /** Sign one of the desk's texts, post it, refetch. */
  const signed = useCallback(
    async (busy: DeskBusy, path: string, text: string, body: (signature: Signature) => Record<string, unknown>): Promise<DeskWriteResult> => {
      if (!wallet || !owner) return { ok: false, reason: DESK_ERRORS_UI.noWallet, status: null };
      if (inFlight.current) return { ok: false, reason: DESK_ERRORS_UI.unknown, status: null };
      inFlight.current = true;
      setState({ busy, phase: "signing", signature: null, problem: null });
      try {
        const signature = await signText(wallet, text);
        setState({ busy, phase: "sending", signature: null, problem: null });
        const result = await post(path, { owner, signature, ...body(signature) });
        setState({ busy: null, phase: result.ok ? "done" : "failed", signature: null, problem: result.ok ? null : result.reason });
        if (result.ok) await invalidate();
        return result;
      } catch (error) {
        const reason = reasonOf(error);
        setState({ busy: null, phase: "failed", signature: null, problem: reason });
        return { ok: false, reason, status: null };
      } finally {
        inFlight.current = false;
      }
    },
    [wallet, owner, post, invalidate],
  );

  /** One mainnet transaction through the owner session; the phase follows sign → send → confirm. */
  const tx = useCallback(
    async (busy: DeskBusy, run: (s: DeskMainnetSession) => Promise<SessionWriteResult>): Promise<DeskWriteResult> => {
      if (!session || !owner) return { ok: false, reason: mainnet.kind === "unsupported" ? mainnet.why : DESK_ERRORS_UI.noWallet, status: null };
      if (inFlight.current) return { ok: false, reason: DESK_ERRORS_UI.unknown, status: null };
      inFlight.current = true;
      setState({ busy, phase: "signing", signature: null, problem: null });
      try {
        const landed = await run(session);
        setState({ busy: null, phase: "done", signature: landed.signature, problem: null });
        await invalidate();
        return { ok: true, signature: landed.signature, body: {} };
      } catch (error) {
        const reason = reasonOf(error);
        setState({ busy: null, phase: "failed", signature: error instanceof DeskSendError ? error.signature : null, problem: reason });
        return { ok: false, reason, status: null };
      } finally {
        inFlight.current = false;
      }
    },
    [session, owner, mainnet, invalidate],
  );

  const nowIso = () => new Date().toISOString();

  return {
    state,
    owner,
    mainnet,
    session,
    reset: () => setState(IDLE),
    /** A mandate version: creates the practice desk when none exists; `test_read` also asks for a check now. */
    signMandate: (i: { mandate: DeskMandate; version: number; trigger: "create" | "test_read" | "edit"; practiceCashE6?: bigint }) => {
      const signedAtIso = nowIso();
      const fingerprint = mandateFingerprint(i.mandate);
      const text = deskMandateText({ owner: owner ?? "", cluster: DESK_CLUSTER, version: i.version, fingerprint, signedAtIso });
      return signed("mandate", "mandate", text, () => ({ mandate: mandateToWire(i.mandate), version: i.version, signedAtIso, trigger: i.trigger, ...(i.practiceCashE6 !== undefined ? { practiceCashE6: i.practiceCashE6.toString() } : {}) }));
    },
    answer: (approval: ApprovalWire, answer: "approve" | "decline") => {
      const text = deskApprovalText({ owner: owner ?? "", cluster: DESK_CLUSTER, decisionSeq: approval.decisionSeq, decisionHash: approval.decisionHash, answer, summary: approval.summary, expiresAtIso: new Date(approval.expiresAtSec * 1000).toISOString() });
      return signed("approval", "approvals", text, () => ({ approvalId: approval.id, answer }));
    },
    checkNow: () => {
      const requestedAtIso = nowIso();
      return signed("check-now", "check-now", deskCheckNowText({ owner: owner ?? "", cluster: DESK_CLUSTER, requestedAtIso }), () => ({ requestedAtIso }));
    },
    share: (on: boolean) => {
      const signedAtIso = nowIso();
      return signed("share", "share", deskShareText({ owner: owner ?? "", on, signedAtIso }), () => ({ on, signedAtIso }));
    },
    /** The index's copy of the mode; with `attach`, the practice row becomes the live desk (Go live's last step). */
    recordMode: (mode: DeskMode, attach?: { address: string; operator: string }) => {
      const signedAtIso = nowIso();
      return signed("mode", "mode", deskModeText({ owner: owner ?? "", mode, signedAtIso, attach }), () => ({ mode, signedAtIso, ...(attach ? { attach } : {}) }));
    },
    requestAction: (kind: OwnerActionKind) => {
      const signedAtIso = nowIso();
      return signed("action", "actions", deskOwnerActionText({ owner: owner ?? "", kind, signedAtIso }), () => ({ kind, signedAtIso }));
    },
    tx,
  };
}

export type DeskWrites = ReturnType<typeof useDeskWrites>;
/** What the desk page's controls need of the writes; `/dev/desk` hands them a stub of this shape. */
export type DeskActions = Pick<DeskWrites, "state" | "owner" | "mainnet" | "session" | "answer" | "checkNow" | "share" | "recordMode" | "requestAction" | "tx" | "reset">;
/** The studio needs the mandate signature on top. */
export type StudioActions = DeskActions & Pick<DeskWrites, "signMandate">;
