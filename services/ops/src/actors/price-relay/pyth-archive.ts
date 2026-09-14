/** Hermes boundary → `print_archive` rows (venue-ops.md §6.4): the exact response text for each trial feed it carries. */
import type { PrintArchiveRow } from "@agari/db";
import type { PythBoundary } from "./hermes-fetch";

export function pythRows(boundary: PythBoundary, skip: ReadonlySet<string>): PrintArchiveRow[] {
  return boundary.parsed
    .filter((p) => !skip.has(`${p.feedIdHex}:${boundary.tSec}`))
    .map((p) => ({ source: "pyth", feed: p.feedIdHex, boundarySec: boundary.tSec, payload: boundary.text, signers: 1, priceE8: p.priceE8.toString(), fetchedAtMs: boundary.fetchedAtMs }));
}
