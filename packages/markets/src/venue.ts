import type { Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { notDeployedReading } from "./stub/not-deployed";

export type VenueSource = "env" | "none";

export interface VenueResolution {
  /** The agari-events `GlobalConfig` address the lanes are read from. */
  venueId: Address | null;
  source: VenueSource;
  liveCount: number;
}

/** One `GlobalConfig` per cluster: the venue is configured, not discovered. Until it exists there is nothing to resolve. */
export async function resolveVenueId(_configured: Address | null | undefined): Promise<Reading<VenueResolution>> {
  return notDeployedReading("the agari-events GlobalConfig is not initialised yet (S1 stub)");
}

export function activeVenue(): VenueResolution | null {
  return null;
}
