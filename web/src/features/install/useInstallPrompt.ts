"use client";

import { useCallback, useEffect, useState } from "react";

/** Chromium's install event — not in lib.dom, so declared here to the extent it is used. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallState = "installed" | "prompt" | "ios" | "manual";
export type InstallChoice = "accepted" | "dismissed";

export interface InstallPrompt {
  state: InstallState;
  /** Opens the browser's install sheet; resolves to the reader's choice, or null when no prompt is held. */
  install: () => Promise<InstallChoice | null>;
  busy: boolean;
}

const STANDALONE_QUERY = "(display-mode: standalone)";

/** Running as an installed app: the display-mode media query, or Safari's own flag. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.(STANDALONE_QUERY).matches === true || nav.standalone === true;
}

/** iOS has no install event; its path is the share sheet. iPadOS reports as a Mac, so touch points decide. */
function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ipad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || ipad;
}

/**
 * The install state machine behind the `/download` CTA. Everything starts as `manual` on the
 * server and on the first client paint, so hydration matches; the real state lands in an effect.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const media = window.matchMedia?.(STANDALONE_QUERY);
    const onMedia = (event: MediaQueryListEvent) => {
      if (event.matches) setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media?.addEventListener?.("change", onMedia);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener?.("change", onMedia);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallChoice | null> => {
    if (!deferred) return null;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // A held prompt is single-use either way; a dismissed one is re-issued by the browser later.
      setDeferred(null);
      return outcome;
    } catch {
      return null;
    } finally {
      setBusy(false);
    }
  }, [deferred]);

  const state: InstallState = installed ? "installed" : deferred ? "prompt" : ios ? "ios" : "manual";
  return { state, install, busy };
}
