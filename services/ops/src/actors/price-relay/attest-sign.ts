/**
 * Opt-in attested prints (`RELAY_ATTESTED=1`, venue-ops.md §6.6): demo data only, signed by `price-attestor`, valued at
 * RedStone's median at T for the Series' ticker. Off by default; no listed Series uses an attested primary in S3.
 */
import { recordAttestedSlot, type PrintSlot } from "@agari/markets/ops/prints";
import { keypairSigner } from "@agari/markets/ops";
import { feedAt } from "./redstone-fetch";
import type { RelayContext } from "./relay-pass";

export interface AttestedContext {
  attestorSecret: Uint8Array;
  clusterTag: number;
}

export async function recordAttested(ctx: RelayContext, attested: AttestedContext, slots: PrintSlot[], chainNow: number): Promise<string> {
  const attestor = await keypairSigner(attested.attestorSecret);
  const parts: string[] = [];
  for (const slot of slots) {
    const symbol = slot.seriesKey.split("-")[0]!;
    const feed = ctx.sources.redstoneFeeds.find((f) => f.symbol === symbol)?.feed;
    const response = feed ? await ctx.cache.redstone(slot.boundarySec) : null;
    const medianE8 = response && feed ? feedAt(response.text, feed, slot.boundarySec, ctx.sources.redstoneSigners)?.medianE8 : null;
    if (!medianE8) {
      parts.push(`${slot.seriesKey} ${slot.slot}: no RedStone value to attest`);
      continue;
    }
    if (ctx.dryRun) {
      parts.push(`DRY attested ${slot.seriesKey} ${slot.slot} @ ${medianE8}e-8`);
      continue;
    }
    const fetchedAtSec = Math.max(slot.earliestSec, Math.min(chainNow, Math.floor(Date.now() / 1000)));
    const outcome = await recordAttestedSlot(ctx.client, slot, { attestor, clusterTag: attested.clusterTag, priceE8: medianE8, fetchedAtSec });
    parts.push(`${slot.seriesKey} ${slot.slot} attested ${outcome.status}${outcome.signature ? ` ${outcome.signature.slice(0, 8)}` : ""}`);
  }
  return `attested: ${parts.join(", ")}`;
}
