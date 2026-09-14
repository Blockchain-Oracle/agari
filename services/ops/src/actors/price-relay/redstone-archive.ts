/** RedStone boundary → `print_archive` rows (venue-ops.md §6.4): the feed's exact gateway array, signer count, median. */
import type { PrintArchiveRow } from "@agari/db";
import { feedAt, type GatewayResponse } from "./redstone-fetch";
import type { RelaySources } from "./sources";

const COMPLETE_BY_SEC = 60;

export type RedstoneRows = { rows: PrintArchiveRow[]; waiting: string[]; unavailable: string[] };

/**
 * A feed is archived once it has every configured signer, or once a fetch at or after T + 60 settles what exists.
 * `skip` holds `"<feed>:<T>"` keys already stored.
 */
export function redstoneRows(sources: RelaySources, response: GatewayResponse, tSec: number, skip: ReadonlySet<string>): RedstoneRows {
  const out: RedstoneRows = { rows: [], waiting: [], unavailable: [] };
  const settled = response.fetchedAtMs / 1000 >= tSec + COMPLETE_BY_SEC;
  for (const { feed } of sources.redstoneFeeds) {
    if (skip.has(`${feed}:${tSec}`)) continue;
    const at = feedAt(response.text, feed, tSec, sources.redstoneSigners);
    const signers = at?.packages.length ?? 0;
    if (!at || signers === 0 || at.medianE8 === null) {
      (settled ? out.unavailable : out.waiting).push(feed);
      continue;
    }
    if (signers < sources.redstoneSignerCount && !settled) {
      out.waiting.push(`${feed} ${signers}/${sources.redstoneSignerCount}`);
      continue;
    }
    out.rows.push({ source: "redstone", feed, boundarySec: tSec, payload: at.json, signers, priceE8: at.medianE8.toString(), fetchedAtMs: response.fetchedAtMs });
  }
  return out;
}
