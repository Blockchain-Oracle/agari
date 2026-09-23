"use client";

import { motion, useReducedMotion } from "motion/react";
import { pct, usdText } from "../format";
import { DECISION } from "./copy-decision";

const S = DECISION.strip;

export interface StripInput {
  /** Decimal strings from the record, e.g. "104.64276840". */
  spot: string;
  mark: string | null;
  mean30m: string;
  index: string | null;
  /** The desk's premium ceiling in bps over the mark, when known. */
  ceilingBps: number | null;
}

interface Marker {
  id: "spot" | "mark" | "mean" | "index";
  label: string;
  value: number;
  text: string;
}

/**
 * What it saw, on one axis (S22): the token price, its mark, its half-hour average and Pyth's index when the venue may
 * read it, with the zone above the premium ceiling shaded. The record's decimals become numbers only here, to place
 * dots; every figure printed is the record's own string.
 */
export function PriceStrip({ spot, mark, mean30m, index, ceilingBps }: StripInput) {
  const reduce = useReducedMotion();
  const markers: Marker[] = [
    { id: "spot" as const, label: S.token, value: Number(spot), text: usdText(spot) },
    ...(mark !== null ? [{ id: "mark" as const, label: S.mark, value: Number(mark), text: usdText(mark) }] : []),
    { id: "mean" as const, label: S.mean, value: Number(mean30m), text: usdText(mean30m) },
    ...(index !== null ? [{ id: "index" as const, label: S.index, value: Number(index), text: usdText(index) }] : []),
  ].filter((m) => Number.isFinite(m.value) && m.value > 0);
  if (markers.length < 2) return null;
  const markValue = mark !== null ? Number(mark) : null;
  const ceiling = markValue !== null && ceilingBps !== null ? markValue * (1 + ceilingBps / 10_000) : null;
  const values = [...markers.map((m) => m.value), ...(ceiling !== null ? [ceiling] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.18, hi * 0.004);
  const min = lo - pad;
  const max = hi + pad;
  const at = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <figure className="dc-strip" aria-label={S.aria}>
      <div className="dc-strip-track">
        {ceiling !== null && (
          <div className="dc-strip-band" style={{ left: `${at(ceiling)}%` }}>
            <span className="dc-strip-band-label">{S.ceiling(pct(ceilingBps ?? 0))}</span>
          </div>
        )}
        {markers.map((m, i) => (
          <motion.span
            key={m.id}
            className="dc-strip-dot"
            data-id={m.id}
            style={{ left: `${at(m.value)}%` }}
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: reduce ? 0 : 0.1 + i * 0.08 }}
            title={`${m.label} ${m.text}`}
          />
        ))}
      </div>
      <figcaption className="dc-strip-legend">
        {markers.map((m) => (
          <span key={m.id} className="dc-strip-key" data-id={m.id}>
            <span className="dc-strip-swatch" aria-hidden />
            <span className="dc-strip-key-label">{m.label}</span>
            <b>{m.text}</b>
          </span>
        ))}
        {ceiling !== null && (
          <span className="dc-strip-key" data-id="ceiling">
            <span className="dc-strip-swatch" aria-hidden />
            <span className="dc-strip-key-label">{S.above}</span>
            <b>{S.over(`$${ceiling.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</b>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
