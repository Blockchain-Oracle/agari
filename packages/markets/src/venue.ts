import type { Reading } from "@masayume/core/schemas";
import type { Bytes32 } from "@masayume/core/types";
import { getClient } from "./runtime/read-runtime";
import { nowSec } from "./provider/clock";
import { withReading } from "./provider/reading";

const DISCOVERY_PAGE = 100;

export type VenueSource = "env" | "inferred" | "none";

export interface VenueResolution {
  venueId: Bytes32 | null;
  source: VenueSource;
  liveCount: number;
}

let active: VenueResolution | null = null;

/** Venue ids have moved three times in a week: trust the configured one only while it has live rows, else read one off the busiest live venue (canon #8). */
export async function resolveVenueId(configured: Bytes32): Promise<Reading<VenueResolution>> {
  return withReading("venue", async () => {
    const client = getClient();
    const scoped = await client.listLiveBinaryMarkets({ venueId: configured, limit: 1, nowSec: nowSec() });
    if (scoped.length > 0) return remember({ venueId: configured, source: "env", liveCount: scoped.length });

    const unscoped = await client.listLiveBinaryMarkets({ limit: DISCOVERY_PAGE, nowSec: nowSec() });
    const counts = new Map<string, number>();
    for (const row of unscoped) if (row.venueId) counts.set(row.venueId, (counts.get(row.venueId) ?? 0) + 1);
    const busiest = [...counts.entries()].sort(([, a], [, b]) => b - a)[0];
    return remember(
      busiest ? { venueId: busiest[0] as Bytes32, source: "inferred", liveCount: busiest[1] } : { venueId: null, source: "none", liveCount: 0 },
    );
  });
}

function remember(resolution: VenueResolution): VenueResolution {
  active = resolution;
  return resolution;
}

export function activeVenue(): VenueResolution | null {
  return active;
}
