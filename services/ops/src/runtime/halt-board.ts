/**
 * The process's halt board (session-lanes.md §3.1): `halt-watch` is its single writer, everything else reads a copy.
 * In memory only: a restart starts empty and `halt-watch` re-derives every halt within one pass.
 */
import type { HaltBoard, HaltReason } from "@agari/core/types";

type HaltAsset = keyof HaltBoard;

export interface HaltBoardStore {
  board(): HaltBoard;
  /** Marks `asset` halted; keeps `sinceSec` while the reason is unchanged. */
  set(asset: HaltAsset, reason: HaltReason, nowSec: number): void;
  clear(asset: HaltAsset): void;
}

export function createHaltBoard(): HaltBoardStore {
  const entries: HaltBoard = {};
  return {
    board: () => ({ ...entries }),
    set(asset, reason, nowSec) {
      if (entries[asset]?.reason !== reason) entries[asset] = { reason, sinceSec: nowSec };
    },
    clear(asset) {
      delete entries[asset];
    },
  };
}
