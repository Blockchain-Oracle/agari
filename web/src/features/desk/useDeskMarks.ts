"use client";

import { basketIndexE8, BASKETS, type BasketSymbol, type PreIpoSymbol } from "@agari/core/market";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

/**
 * The hourly PreStocks marks (S22): one cached read for the studio and the holdings. Marks move hourly, so the
 * query is fresh for five minutes and shared by every card on the page.
 */
const marksSchema = z.object({ marks: z.record(z.string(), z.array(z.object({ atSec: z.number(), tokenE8: z.string() }))), toSec: z.number() });
export type DeskMarks = Record<string, Array<{ atSec: number; tokenE8: bigint }>>;

export function useDeskMarks(): DeskMarks | null {
  const q = useQuery({
    queryKey: ["agari", "desk", "marks"],
    queryFn: async (): Promise<DeskMarks | null> => {
      const response = await fetch("/api/desk/marks");
      if (!response.ok) return null;
      const parsed = marksSchema.safeParse(await response.json());
      if (!parsed.success) return null;
      return Object.fromEntries(Object.entries(parsed.data.marks).map(([s, rows]) => [s, rows.map((r) => ({ atSec: r.atSec, tokenE8: BigInt(r.tokenE8) }))]));
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
  return q.data ?? null;
}

/** A name's hourly price line, oldest first. */
export const markLine = (marks: DeskMarks | null, symbol: PreIpoSymbol): bigint[] => marks?.[symbol]?.map((m) => m.tokenE8) ?? [];

/** A basket's index at every hour all its members were marked; the same equal-weight arithmetic the venue signs. */
export function basketLine(marks: DeskMarks | null, basket: BasketSymbol): bigint[] {
  if (!marks) return [];
  const members = BASKETS[basket].members;
  const byHour = new Map<number, Map<PreIpoSymbol, bigint>>();
  for (const m of members) for (const row of marks[m.symbol] ?? []) byHour.set(row.atSec, (byHour.get(row.atSec) ?? new Map()).set(m.symbol, row.tokenE8));
  return [...byHour.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, prices]) => (prices.size === members.length ? [basketIndexE8(members, prices)] : []))
    .filter((v): v is bigint => v !== null);
}

/** Display only: a bigint line as plain numbers for an SVG. */
export const lineNumbers = (line: readonly bigint[]): number[] => line.map((v) => Number(v));
