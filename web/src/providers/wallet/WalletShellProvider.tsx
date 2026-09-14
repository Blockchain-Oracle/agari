"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { webEnv } from "@/lib/env";
import type { IslandHandle } from "../privy";
import { DISCONNECTED, WalletShellContext, type WalletShell, type WalletShellState } from "./wallet-shell-context";

/** Set while a Privy session exists, so a returning visitor's island loads at once; absent, it loads on first intent. */
const REMEMBERED_KEY = "agari.wallet.remembered";

const loadIsland = () => import("../privy");
const PrivyIsland = dynamic(() => loadIsland().then((m) => m.PrivyIsland), { ssr: false });

function readRemembered(): boolean {
  try {
    return window.localStorage.getItem(REMEMBERED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRemembered(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(REMEMBERED_KEY, "1");
    else window.localStorage.removeItem(REMEMBERED_KEY);
  } catch {
    // storage blocked: the island simply loads on intent next visit
  }
}

/**
 * Owns the lazy Privy island (D-017). The island renders no children, so loading it never remounts the app:
 * it only publishes state up into this context and hands back its actions. A click that arrives before the
 * island is ready is queued and replayed once Privy reports ready.
 */
export function WalletShellProvider({ children }: { children: ReactNode }) {
  const configured = Boolean(webEnv.privyAppId);
  const [state, setState] = useState<WalletShellState>({ ...DISCONNECTED, status: configured ? "idle" : "unavailable" });
  const [load, setLoad] = useState(false);
  const island = useRef<IslandHandle | null>(null);
  const pendingLogin = useRef(false);

  useEffect(() => {
    const remembered = configured && readRemembered();
    setState((prev) => ({ ...prev, hydrated: true, status: remembered ? "restoring" : prev.status }));
    if (remembered) setLoad(true);
  }, [configured]);

  const onReady = useCallback((handle: IslandHandle) => {
    island.current = handle;
    if (pendingLogin.current) {
      pendingLogin.current = false;
      handle.login();
    }
  }, []);

  const onState = useCallback((next: Omit<WalletShellState, "hydrated">) => {
    writeRemembered(next.authenticated);
    setState({ ...next, hydrated: true });
  }, []);

  const login = useCallback(() => {
    if (!configured) return;
    if (island.current) island.current.login();
    else {
      pendingLogin.current = true;
      setLoad(true);
    }
  }, [configured]);

  const logout = useCallback(async () => {
    writeRemembered(false);
    await island.current?.logout();
  }, []);

  const prefetch = useCallback(() => {
    if (configured) void loadIsland();
  }, [configured]);

  const value = useMemo<WalletShell>(() => ({ ...state, login, logout, prefetch }), [state, login, logout, prefetch]);

  return (
    <WalletShellContext.Provider value={value}>
      {load && configured && <PrivyIsland appId={webEnv.privyAppId!} onState={onState} onReady={onReady} />}
      {children}
    </WalletShellContext.Provider>
  );
}
