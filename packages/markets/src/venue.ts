import { ok, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { withReading } from "./provider/reading";
import { configAddress } from "./runtime/accounts";
import { nowMs } from "./provider/clock";

/**
 * `env`: a configured id that equals the program's config PDA; `inferred`: no id configured, so the PDA itself (spec
 * §2.2 names this `derived`; the `/status` copy still keys it `inferred`, so the rename waits on that copy).
 */
export type VenueSource = "env" | "inferred" | "none";

export interface VenueResolution {
  /** The agari-events `GlobalConfig` address the lanes are read from. */
  venueId: Address | null;
  source: VenueSource;
  /** Not counted at resolution (it would cost an index read before any list); lanes carry the live Windows. */
  liveCount: number;
}

let active: VenueResolution | null = null;

/**
 * One `GlobalConfig` per program: the venue is derived (`["config"]`), not discovered, so resolving it costs no network.
 * A configured id must equal the derivation; a mismatch is a misconfiguration, never a second venue.
 */
export async function resolveVenueId(configured: Address | null | undefined): Promise<Reading<VenueResolution>> {
  if (active && (!configured || active.venueId === configured)) return ok(active, nowMs());
  return withReading(`venue:${configured ?? "derived"}`, async () => {
    const derived = (await configAddress()) as string as Address;
    if (configured && configured !== derived) {
      throw new Error(`NEXT_PUBLIC_AGARI_VENUE_ID ${configured} is not this program's config PDA ${derived}`);
    }
    active = { venueId: derived, source: configured ? "env" : "inferred", liveCount: 0 };
    return active;
  });
}

export function activeVenue(): VenueResolution | null {
  return active;
}
