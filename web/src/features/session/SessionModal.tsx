"use client";

import type { Diagnosis } from "@masayume/core/types";
import { sessionGasTopUpWei } from "@masayume/markets";
import { useBalanceSheet } from "@masayume/markets/react";
import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/toast";
import { CapabilityReceipt } from "./CapabilityReceipt";
import { CapsEditor } from "./CapsEditor";
import { CAPS_DEFAULTS, termsFromForm, workedExample, type CapsForm } from "./caps";
import { SESSION } from "./copy";
import { useSessionKey } from "./SessionKeyProvider";
import styles from "./SessionDetails.module.css";

interface ShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  labelId: string;
}

/**
 * The reference's one dialog shape (`AddFunds.tsx` L58–67): a centred panel over a blurred scrim, Escape and
 * the scrim close it, the body scrolls and the footer stays. The bottom sheet this replaces was painted on
 * `bg-popover` — a `#404040` the reference's palette never uses for a panel — with its inner cards darker than
 * the panel and a submit button that scrolled off a phone. Yosuku has no bottom sheets at all.
 */
export function SessionModalShell({ open, onClose, title, description, children, footer, labelId }: ShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, summary, [tabindex]"))
      .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
    (focusable()[0] ?? panel).focus({ preventScroll: true });
    const keepFocusInPanel = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0] ?? panel;
      const last = elements.at(-1) ?? panel;
      const active = document.activeElement;
      if (!panel.contains(active) || active === panel || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", keepFocusInPanel);
    return () => {
      document.removeEventListener("keydown", keepFocusInPanel);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className={`modal-root ${styles.overlay}`} onClick={onClose}>
      <div className="modal-scrim" />
      <div ref={panelRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={labelId} aria-describedby={`${labelId}-description`} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label={SESSION.modal.close} className="modal-close" data-cursor="hover">
          <X className="h-4 w-4" />
        </button>
        <div className="modal-head">
          <div className="modal-eyebrow-row">
            <span className="modal-eyebrow-dot" />
            <span className="modal-eyebrow">{SESSION.modal.eyebrow}</span>
          </div>
          <h2 id={labelId} className="modal-title">
            {title}
          </h2>
          <p id={`${labelId}-description`} className="modal-desc">{description}</p>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface SessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
}

/**
 * The arm flow. Its first face is the reference's `AccountSetup` moment (`components/AccountSetup.tsx`
 * L63–97): one strong sentence, one button. The caps — which are ours, and real — sit behind "adjust" at
 * sensible defaults, and the capability receipt behind "what you are signing", so the modal opens on a
 * decision rather than on six inputs. No Yosuku source exists for a browser key (its one-tap was sponsored),
 * so this is Adapted; what is verbatim is the grammar.
 */
export function SessionModal({ open, onOpenChange, symbol }: SessionModalProps) {
  const { view, actions, busy } = useSessionKey();
  const [form, setForm] = useState<CapsForm>(CAPS_DEFAULTS);
  const [refusal, setRefusal] = useState<Diagnosis | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const sheet = useBalanceSheet(view.owner);
  const walletBase = sheet?.ok ? sheet.value.spendableBase : null;
  const decimals = view.decimals;
  const terms = view.key ? termsFromForm(form, decimals, view.key.address, view.nowSec) : null;
  const example = workedExample(form, decimals, symbol);
  const enabling = busy === "enabling" || busy === "topping-up";
  const depositShort = terms?.ok && walletBase !== null && walletBase < terms.amountBase;
  const close = () => onOpenChange(false);

  const submit = async () => {
    setRefusal(null);
    setFieldError(null);
    const { outcome, topUpError } = await actions.enable(form);
    if (outcome.status === "confirmed") {
      notify.neutral(SESSION.sheet.armed, topUpError ? topUpError : SESSION.sheet.armedBody);
      close();
      return;
    }
    if (outcome.status === "refused" && outcome.diagnosis.kind === "unknown") setFieldError(outcome.diagnosis.technical);
    else if (outcome.status !== "unknown") setRefusal(outcome.diagnosis);
  };

  const footer = (
    <>
      {fieldError && <p className="type-caption text-warning">{fieldError}</p>}
      {depositShort && walletBase !== null && <p className="type-caption text-warning">{SESSION.sheet.errors.walletShort(`${formatMoney(walletBase, decimals)} ${symbol}`)}</p>}
      {refusal && <ErrorState diagnosis={refusal} retry={() => setRefusal(null)} />}
      <Button size="lg" className="w-full" disabled={enabling || view.status === "loading" || !view.owner} onClick={() => void submit()}>
        {enabling && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy === "topping-up" ? SESSION.sheet.ctaTopUp : enabling ? SESSION.sheet.ctaBusy : SESSION.sheet.cta}
      </Button>
    </>
  );

  return (
    <SessionModalShell open={open} onClose={close} title={SESSION.sheet.title} description={SESSION.sheet.intro} labelId="session-arm-title" footer={footer}>
      <div className="setup-card">
        <div className="setup-line">
          <Sparkles aria-hidden />
          <p className="setup-text">
            <strong>{SESSION.modal.lead}</strong> {view.sponsor?.configured ? SESSION.modal.sponsored : SESSION.modal.keyPays} {SESSION.modal.skip}
          </p>
        </div>
      </div>
      <details className="modal-disclosure">
        <summary>{SESSION.modal.adjust(`${form.perTradeText} ${symbol}`, `${form.dailyText} ${symbol}`, `${form.expiryHours >= 24 ? `${form.expiryHours / 24}d` : `${form.expiryHours}h`}`)}</summary>
        <CapsEditor form={form} onChange={setForm} symbol={symbol} disabled={enabling} />
        {example && <p className="type-caption text-ink-secondary">{example}</p>}
        <p className="type-caption text-ink-muted">{SESSION.sheet.resets}</p>
      </details>
      <details className="modal-disclosure">
        <summary>{SESSION.sheet.receiptTitle}</summary>
        <CapabilityReceipt keyAddress={view.key?.address ?? null} expiresAtSec={view.nowSec + form.expiryHours * 3600} sponsorConfigured={view.sponsor?.configured ?? false} topUpWei={sessionGasTopUpWei()} firstTime={view.grant === null} />
      </details>
    </SessionModalShell>
  );
}

function formatMoney(base: bigint, decimals: number): string {
  const whole = base / 10n ** BigInt(decimals);
  const frac = ((base % 10n ** BigInt(decimals)) * 100n) / 10n ** BigInt(decimals);
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}
