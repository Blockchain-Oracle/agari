import type { Pick } from "@agari/core/games";
import { createContext, useContext } from "react";

/**
 * Which way the active card is being dragged, past the stamp line. web drives the face's art swap from the card's
 * `data-swipe` attribute in CSS; here the deck provides it and the face reads it, so the face still knows nothing
 * about the gesture itself.
 */
export const LeanContext = createContext<Pick | null>(null);

export function useLean(): Pick | null {
  return useContext(LeanContext);
}
