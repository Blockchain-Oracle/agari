"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

const isVisible = () => document.visibilityState === "visible";
const serverSnapshot = () => true;

/** Hidden tabs poll nothing and animate nothing. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, isVisible, serverSnapshot);
}
