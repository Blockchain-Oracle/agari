import type { Hex } from "@masayume/core/types";

export interface KeeperEnv {
  privateKey: Hex | null;
  refreshMs: number;
  dryRun: boolean;
  venueId: string | undefined;
}

const DEFAULT_REFRESH_MS = 20_000;

/** Read once at boot; a missing key means scan-and-report, never a guessed signer. Dry run unless told otherwise. */
export function readKeeperEnv(env: NodeJS.ProcessEnv = process.env): KeeperEnv {
  const key = env.LEVERAGE_KEEPER_PRIVATE_KEY;
  const refresh = Number(env.LK_REFRESH_MS);
  return {
    privateKey: key && /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as Hex) : null,
    refreshMs: Number.isFinite(refresh) && refresh >= 5_000 ? refresh : DEFAULT_REFRESH_MS,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
    venueId: env.VENUE_ID,
  };
}
