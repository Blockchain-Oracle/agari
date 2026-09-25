import { useSyncExternalStore } from "react";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: "neutral" | "warning";
}

/** Base UI's default toast timeout, which web's Toaster keeps. */
const LIFETIME_MS = 5_000;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function pushToast(toast: Omit<ToastItem, "id">): void {
  const id = nextId++;
  // web's Toaster limit={1}: a new toast replaces the one showing.
  items = [{ ...toast, id }];
  emit();
  setTimeout(() => dismissToast(id), LIFETIME_MS);
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => items, () => items);
}
