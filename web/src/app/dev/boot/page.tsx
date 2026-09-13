import { ensureMarkets, getClient, PINNED_TESTNET, SOMNIA_SHANNON } from "@masayume/markets";
import { webEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Client = ReturnType<typeof getClient>;
type LiveMarkets = Awaited<ReturnType<Client["listLiveBinaryMarkets"]>>;
type SyncStatus = Awaited<ReturnType<Client["getSyncStatus"]>>;

type Probe =
  | { ok: true; markets: LiveMarkets; sync: SyncStatus; latencyMs: number }
  | { ok: false; message: string };

async function probeShannon(): Promise<Probe> {
  ensureMarkets(webEnv.markets);
  const client = getClient();
  const startedMs = Date.now();
  try {
    const [markets, sync] = await Promise.all([
      client.listLiveBinaryMarkets({ venueId: webEnv.markets.venueId, limit: 8 }),
      client.getSyncStatus(webEnv.markets.chainId),
    ]);
    return { ok: true, markets, sync, latencyMs: Date.now() - startedMs };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function utc(unixSec: string): string {
  return new Date(Number(unixSec) * 1000).toISOString();
}

export default async function BootPage() {
  const probe = await probeShannon();
  const { markets: env } = webEnv;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 font-mono text-sm">
      <h1 className="text-xl font-semibold">Boot check — Somnia Shannon</h1>

      <section>
        <h2 className="font-semibold">Config (zero-env defaults unless overridden)</h2>
        <ul>
          <li>chain: {SOMNIA_SHANNON.name} ({env.chainId})</li>
          <li>indexer: {env.indexerUrl}</li>
          <li>ws rpc: {env.rpcWsUrls.join(", ")}</li>
          <li>venue: {env.venueId}</li>
          <li>sdk: {PINNED_TESTNET.sdkVersion} · module {PINNED_TESTNET.addresses.binaryModule}</li>
        </ul>
      </section>

      {probe.ok ? (
        <>
          <section>
            <h2 className="font-semibold">Indexer ({probe.latencyMs} ms)</h2>
            {probe.sync ? (
              <p>
                processed {probe.sync.latestProcessedBlock ?? "—"} / head {probe.sync.blockHeight ?? "—"} · events{" "}
                {probe.sync.numEventsProcessed ?? "—"}
              </p>
            ) : (
              <p>no sync row for chain {env.chainId}</p>
            )}
          </section>
          <section>
            <h2 className="font-semibold">Live up/down markets on this venue: {probe.markets.length}</h2>
            <ul>
              {probe.markets.map((m: LiveMarkets[number]) => (
                <li key={m.marketId}>
                  {m.asset} · {m.interval ?? `${m.intervalSec ?? "?"}s`} · {m.status} · expires {utc(m.expiry)} ·{" "}
                  {m.marketId.slice(0, 10)}…
                </li>
              ))}
            </ul>
            {probe.markets.length === 0 && <p>Empty scope — the venue id may have moved (Story 1.3 re-reads it off a live row).</p>}
          </section>
        </>
      ) : (
        <section>
          <h2 className="font-semibold">Indexer unreachable</h2>
          <p>{probe.message}</p>
        </section>
      )}
    </main>
  );
}
