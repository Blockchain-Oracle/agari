/**
 * The page's visibility, typed without the DOM lib (markets also compiles inside Node services). Null on a server.
 */
interface VisibilityDocument {
  visibilityState: "visible" | "hidden" | "prerender";
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export function pageDocument(): VisibilityDocument | null {
  return (globalThis as { document?: VisibilityDocument }).document ?? null;
}

export const pageHidden = (): boolean => pageDocument()?.visibilityState === "hidden";
