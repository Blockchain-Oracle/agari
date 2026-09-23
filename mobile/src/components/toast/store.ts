import { useSyncExternalStore } from "react";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: "neutral" | "warning";
}

const LIFETIME_MS = 4_000;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function pushToast(toast: Omit<ToastItem, "id">): void {
  const id = nextId++;
  items = [...items.slice(-2), { ...toast, id }];
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
