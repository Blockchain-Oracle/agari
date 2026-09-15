/**
 * Switchboard and attested print policies for the 24/7 token lane (session-lanes.md §2.4–2.5). Lane 6b owns this file;
 * the foundation stub refuses, as `policyFor` did before S6, so no Series can be registered on an unbuilt policy.
 */
import type { PrintPolicyInput } from "@agari/clients/agari-events";
import type { PolicyVersionArgs, PriceSources, SourceName, TickerSources } from "./policies";

const notBuilt = (what: string) => new Error(`${what}: lane not built (6b, deploy/policies-token.ts)`);

/** The token lane's versions for a ticker (`TSLA` → the TSLAx Series), from `price-sources.json` `tokenLane`. */
export function tokenPolicyVersions(symbol: string, _sources: PriceSources): PolicyVersionArgs[] {
  throw notBuilt(`${symbol} token versions`);
}

export function tokenPolicyFor(source: SourceName, _ticker: TickerSources, _sources: PriceSources, _check: boolean): PrintPolicyInput {
  throw notBuilt(`${source} policies`);
}
