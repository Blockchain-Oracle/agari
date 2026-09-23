import type { WebEnv } from "../../../web/src/lib/env";
import { marketsEnv, SITE_URL } from "~/lib/env";

/** Stands in for web/src/lib/env.ts (Next's NEXT_PUBLIC_* inlining) wherever web code the app reuses reads `webEnv`. */
export const webEnv: WebEnv = {
  markets: marketsEnv,
  solanaRpcUrl: marketsEnv.rpcHttpUrls[0],
  solanaWsUrl: marketsEnv.rpcWsUrls[0],
  appOrigin: SITE_URL,
};
export type { WebEnv };
