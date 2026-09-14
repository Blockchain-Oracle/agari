/**
 * The seed maker, `MAKER_MODE=seat` (venue-ops.md §8): two-sided PostOnly quotes around a spot-vs-open fair value on
 * every trading Window of the launch tickers, from the `maker` key's own seat. Books have quotes; that is the job.
 * Vault mode (S8) is the other actor in `../index.ts`.
 */
import { chainNowSec, fetchMarkets, fetchSeries, listSeries, windowAddresses, type SeriesView } from "@agari/markets/ops";
import { readVenueConfig, type VenueConfig } from "@agari/markets/ops/maker";
import type { TickerSymbol } from "@agari/core/market";
import { runActor, type PassResult, type VenueDeps } from "../../../runtime";
import { roleClient } from "../../settler/role-client";
import { seriesLabel, marketLabel } from "../../settler/views";
import { readSeatMakerEnv } from "./env";
import type { Placed } from "./quote";
import { tendWindow } from "./window";

const SERIES_LIST_MS = 5 * 60_000;

export async function startSeedMaker(deps: VenueDeps): Promise<{ stop: () => void }> {
  const env = readSeatMakerEnv();
  const { client, signing } = await roleClient(deps.env, "maker");
  if (!signing) deps.log("MAKER_PRIVATE_KEY and ~/.config/agari/devnet/maker.json are missing: scanning and reporting only");
  else deps.log(`seed maker key ${client.payer.address}`);
  const dryRun = deps.env.dryRun || !signing;
  let config: VenueConfig | null = null;
  let series: SeriesView[] = [];
  let listedAtMs = 0;
  const placed = new Map<string, Placed>();

  const pass = async (): Promise<PassResult> => {
    config ??= await readVenueConfig(client);
    await deps.sessions.refresh();
    if (Date.now() - listedAtMs > SERIES_LIST_MS) {
      series = (await listSeries(client)).filter((s) => s.symbol !== null && s.data.basis === 0 && env.cadencesSec.includes(s.data.cadenceSec) && (!env.symbols || env.symbols.includes(s.symbol)));
      listedAtMs = Date.now();
    } else {
      series = (await fetchSeries(client, series.map((s) => s.address))).filter((s): s is SeriesView => s !== null);
    }
    const nowSec = await chainNowSec(client);
    const status = deps.sessions.status(nowSec);
    const inSession = status !== null && (status.state === "regular" || status.state === "early-close");
    // The newest two indices: the trading Window and, near a boundary, the one just listed after it.
    const refs = (await Promise.all(series.flatMap((s) => [1n, 2n].filter((k) => s.data.nextIndex >= k).map(async (k) => ({ s, market: (await windowAddresses(s.address, s.data.nextIndex - k)).market })))));
    const views = await fetchMarkets(client, refs.map((r) => r.market));
    const notes: string[] = [];
    const live = new Set<string>();
    for (const [i, ref] of refs.entries()) {
      const m = views[i];
      if (!m || m.data.state !== 0) continue;
      const symbol = ref.s.symbol as TickerSymbol;
      const spot = deps.spot?.latest(symbol, env.spotMaxAgeSec) ?? null;
      const label = marketLabel(ref.s, m);
      try {
        const result = await tendWindow(
          { client, config, env, dryRun, nowSec, inSession, closesAtSec: status?.closesAtSec ?? null, spotE8: spot?.priceE8 ?? null, log: deps.log },
          ref.s, symbol, m, placed.get(m.address) ?? null, label,
        );
        if (result.placed) placed.set(m.address, result.placed);
        else if (result.state !== "resting") placed.delete(m.address);
        if (result.state === "quoting" || result.state === "resting") {
          live.add(m.address);
          notes.push(`${seriesLabel(ref.s)} ${result.note}`);
        }
      } catch (error) {
        deps.log(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    for (const key of placed.keys()) if (!live.has(key)) placed.delete(key);
    const session = status?.state ?? "no calendar";
    return {
      why: `${notes.length ? notes.join("; ") : "no quotes resting"} · session ${session}${deps.spot ? "" : " · no spot feed"}${dryRun ? " · DRY RUN" : ""}`,
      detail: { quoting: notes.length, series: series.length, session },
    };
  };

  const { stop } = runActor({ name: "seed-maker", log: deps.log, dryRun, everyMs: env.refreshMs, pass });
  return { stop };
}
