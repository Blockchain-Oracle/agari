import { CLUSTER_LABEL } from "@agari/core/constants";
import { ensureMarkets, getClient, NOT_DEPLOYED_TECHNICAL } from "@agari/markets";
import { webEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Boot check — the markets runtime as this deployment configured it. Masayume probed the DreamDEX indexer and its live
 * markets here; on Solana the engine and the indexer arrive with S2 and S3, so the honest probe is the configuration
 * itself and the stub's own answer until they do (D-015).
 */
export default async function BootPage() {
  ensureMarkets(webEnv.markets);
  const client = getClient();
  const { markets: env } = webEnv;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 font-mono text-sm">
      <h1 className="text-xl font-semibold">Boot check — {CLUSTER_LABEL[env.cluster]}</h1>
      <section>
        <h2 className="font-semibold">Config (zero-env defaults unless overridden)</h2>
        <ul>
          <li>
            cluster: {CLUSTER_LABEL[client.cluster]} ({env.chainId})
          </li>
          <li>http rpc: {client.rpcHttpUrl}</li>
          <li>ws rpc: {client.rpcWsUrl}</li>
          <li>indexer: {env.indexerUrl ?? "—"}</li>
          <li>venue: {env.venueId ?? "—"}</li>
          <li>agari-events: {client.eventsProgramId ?? "—"}</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Engine</h2>
        <p>{client.eventsProgramId ? `program ${client.eventsProgramId}` : NOT_DEPLOYED_TECHNICAL}</p>
      </section>
    </main>
  );
}
