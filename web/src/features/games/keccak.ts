/**
 * The commitment hash, re-exported from the one implementation (`@agari/markets/games`). Three places need the same
 * digest — this browser, the ops deckmaster and `agari-arena` itself — and a second implementation is a second chance
 * to get it wrong.
 */
export { keccak256 } from "@agari/markets/games";
