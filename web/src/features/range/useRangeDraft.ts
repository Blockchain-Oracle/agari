"use client";

import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { printToUsd, usdToPrint } from "./format";
import { bandHalfUsd, bandUnitUsd, centerMaxUsd, snapOffset, trackHalfUsd, unitDecimals, type RangePresetKey } from "./presets";

export interface RangeDraft {
  preset: RangePresetKey;
  setPreset: (key: RangePresetKey) => void;
  /** Dollars the band centre sits from spot, on the grid, clamped to the cadence's limit. */
  offset: number;
  centerMax: number;
  half: number;
  /** The centre grid in dollars (the reference's $5 on BTC) and the decimals a figure on it needs. */
  unit: number;
  decimals: number;
  /** Half the track's span in dollars — what the slider's geometry is drawn against. */
  axisHalf: number;
  setOffset: (usd: number) => void;
  recenter: () => void;
  nudge: (direction: -1 | 1) => void;
  /** The band in dollars on the grid and in the oracle's cents; null until spot is known. */
  spotUsd: number | null;
  lowUsd: number | null;
  highUsd: number | null;
  lowPrint: bigint | null;
  highPrint: bigint | null;
  dragging: boolean;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/**
 * The reference's band state (`Ticket624Drawer.tsx` L203–333): a width preset scaled per cadence, a centre
 * offset in grid steps around spot, dragged on a track or moved with the keyboard. The grid is the
 * reference's five dollars on BTC and scales with the asset's price (see `presets.ts`).
 */
export function useRangeDraft(spot: bigint | null, intervalSec: number): RangeDraft {
  const [preset, setPreset] = useState<RangePresetKey>("medium");
  const [rawOffset, setRawOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startOffset: number; usdPerPx: number } | null>(null);

  const spotUsd = spot === null ? null : printToUsd(spot);
  const unit = bandUnitUsd(spotUsd);
  const decimals = unitDecimals(unit);
  const half = bandHalfUsd(preset, intervalSec, spotUsd);
  const centerMax = centerMaxUsd(intervalSec, spotUsd);
  const axisHalf = trackHalfUsd(half, centerMax, unit);
  const offset = Math.max(-centerMax, Math.min(centerMax, rawOffset));
  const center = spotUsd === null ? null : roundTo(Math.round((spotUsd + offset) / unit) * unit, decimals);
  const lowUsd = center === null ? null : roundTo(center - half, decimals);
  const highUsd = center === null ? null : roundTo(center + half, decimals);

  const setOffset = useCallback((usd: number) => setRawOffset(snapOffset(usd, centerMax, unit)), [centerMax, unit]);
  const recenter = useCallback(() => setRawOffset(0), []);
  const nudge = useCallback((direction: -1 | 1) => setRawOffset((prev) => snapOffset(prev + direction * unit, centerMax, unit)), [centerMax, unit]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track) return;
      const width = track.getBoundingClientRect().width;
      if (width <= 0) return;
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startOffset: offset, usdPerPx: (axisHalf * 2) / width };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [axisHalf, offset],
  );
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      setOffset(drag.startOffset + (e.clientX - drag.startX) * drag.usdPerPx);
    },
    [setOffset],
  );
  const onPointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") nudge(-1);
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") nudge(1);
      else if (e.key === "Home") recenter();
      else return;
      e.preventDefault();
    },
    [nudge, recenter],
  );

  return {
    preset,
    setPreset,
    offset,
    centerMax,
    half,
    unit,
    decimals,
    axisHalf,
    setOffset,
    recenter,
    nudge,
    spotUsd,
    lowUsd,
    highUsd,
    lowPrint: lowUsd === null ? null : usdToPrint(lowUsd),
    highPrint: highUsd === null ? null : usdToPrint(highUsd),
    dragging,
    trackRef,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onKeyDown,
  };
}
