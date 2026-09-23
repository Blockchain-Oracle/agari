import { AppState, type AppStateStatus } from "react-native";

/**
 * Stands in for packages/markets/src/runtime/page.ts: the app's foreground state as the page visibility markets
 * pauses on, so a backgrounded app stops the book sockets, polls and the price stream as a hidden tab does.
 */
interface VisibilityDocument {
  visibilityState: "visible" | "hidden" | "prerender";
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

const visibility = (state: AppStateStatus): VisibilityDocument["visibilityState"] => (state === "active" ? "visible" : "hidden");
const subscriptions = new Map<() => void, { remove(): void }>();

const appDocument: VisibilityDocument = {
  get visibilityState() {
    return visibility(AppState.currentState);
  },
  addEventListener(_type, listener) {
    if (!subscriptions.has(listener)) subscriptions.set(listener, AppState.addEventListener("change", listener));
  },
  removeEventListener(_type, listener) {
    subscriptions.get(listener)?.remove();
    subscriptions.delete(listener);
  },
};

export function pageDocument(): VisibilityDocument | null {
  return appDocument;
}

export const pageHidden = (): boolean => appDocument.visibilityState === "hidden";
