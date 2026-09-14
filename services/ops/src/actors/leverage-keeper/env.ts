import { readSecretKey } from "../secret-key";

export interface KeeperEnv {
  /** The role's 64-byte Solana keypair. */
  privateKey: Uint8Array | null;
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
    privateKey: readSecretKey(key),
    refreshMs: Number.isFinite(refresh) && refresh >= 5_000 ? refresh : DEFAULT_REFRESH_MS,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
    venueId: env.VENUE_ID,
  };
}
