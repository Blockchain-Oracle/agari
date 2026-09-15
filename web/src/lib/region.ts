"use client";

import { useSyncExternalStore } from "react";
import { readRegionRestricted } from "./region-mark";

/** The browser's half of the geofence (D-095); the marks themselves live in `region-mark.ts`. */
export { readRegionRestricted };

// The cookie is written once per document and never changes under the running page, so the store has
// nothing to notify and nothing to poll: `getSnapshot` returns a primitive React can compare for free.
const subscribe = () => () => {};
const serverSnapshot = () => false;

/** The proxy's verdict, hydration-safe: the server renders open, the browser corrects it on the first commit. */
export function useRegionRestricted(): boolean {
  return useSyncExternalStore(subscribe, readRegionRestricted, serverSnapshot);
}
