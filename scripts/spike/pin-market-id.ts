import { decodeOutcomeId, marketIdOf, marketKey, outcomeIdsOf, readModuleMarket, readSettlementRecord } from "@masayume/markets/identity";
import { runSpike, short, type Client } from "./lib/boot";
import { bullets, heading, table } from "./lib/markdown";

const SAMPLE_PER_PHASE = 5;
const MODULE_POOL = 9;
const MODULE_YES_ID = 10;
const MODULE_NO_ID = 11;

type MarketRow = Awaited<ReturnType<Client["getBinaryMarket"]>> & object;

interface Verdict {
  row: MarketRow;
  phase: "live" | "finalized";
  marketIdDecimal: bigint;
  key: bigint;
  checks: Record<string, boolean | null>;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function verify(client: Client, row: MarketRow, phase: Verdict["phase"]): Promise<Verdict> {
  const marketId = marketIdOf(row);
  const viem = client.getViemClient();
  const onchain = await client.getMarketOnchain(marketId);
  const module = await readModuleMarket(viem, marketId);
  const settlement = await readSettlementRecord(viem, onchain.yesId);
  const decoded = decodeOutcomeId(onchain.yesId);
  const encoded = outcomeIdsOf(onchain.pool, onchain.nonce);
  const key = marketKey(onchain.yesId);
  return {
    row,
    phase,
    marketIdDecimal: BigInt(marketId),
    key,
    checks: {
      "decode(yesId).pool == pool": same(decoded.pool, onchain.pool),
      "decode(yesId).nonce == nonce": decoded.nonce === onchain.nonce,
      "decode(yesId).idx == 0": decoded.idx === 0,
      "encode(pool,nonce) == {yesId,noId}": encoded.yesId === onchain.yesId && encoded.noId === onchain.noId,
      "marketKey == yesId>>8 == marketKey(noId)": key === onchain.yesId >> 8n && key === marketKey(onchain.noId),
      "indexer yes/noTokenId == chain": BigInt(row.yesTokenId) === onchain.yesId && BigInt(row.noTokenId) === onchain.noId,
      "indexer pool == chain": same(row.poolAddress, onchain.pool),
      "indexer nonce == chain": row.nonce ? BigInt(row.nonce) === onchain.nonce : null,
      "module.markets(marketId) == chain": module[MODULE_YES_ID] === onchain.yesId && module[MODULE_NO_ID] === onchain.noId && same(module[MODULE_POOL], onchain.pool),
      "settlement finalized": settlement.finalized,
      "settlement (pool,nonce) == chain": settlement.finalized ? same(settlement.pool, onchain.pool) && settlement.nonce === onchain.nonce : null,
      "settlement finalized == onchain.finalized": settlement.finalized === onchain.finalized,
    },
  };
}

await runSpike(async ({ client, env }) => {
  const live = await client.listLiveBinaryMarkets({ venueId: env.venueId, limit: SAMPLE_PER_PHASE });
  const finalized = await client.listBinaryMarkets({ venueId: env.venueId, status: "Finalized", limit: SAMPLE_PER_PHASE });
  const verdicts: Verdict[] = [];
  for (const row of live) verdicts.push(await verify(client, row, "live"));
  for (const row of finalized) verdicts.push(await verify(client, row, "finalized"));

  const checkNames = Object.keys(verdicts[0]?.checks ?? {});
  console.log(heading(1, `Market identity — venue ${short(env.venueId)} — ${new Date().toISOString()}`));
  console.log(
    table(
      ["market", "phase", "marketId (dec)", "marketKey (dec)", ...checkNames],
      verdicts.map((v) => [short(v.row.marketId), v.phase, v.marketIdDecimal, v.key, ...checkNames.map((name) => v.checks[name] ?? null)]),
    ),
  );

  const failures = verdicts.flatMap((v) => checkNames.filter((name) => v.checks[name] === false && !name.startsWith("settlement finalized")).map((name) => `${short(v.row.marketId)}: ${name}`));
  const first = verdicts[0];
  console.log(heading(2, "Pin"));
  console.log(
    bullets([
      `MARKET_ID_FIELD = marketId — bytes32, the BinaryMarketsModule.markets() key and the indexer primary key; values are small sequential integers (e.g. ${first?.marketIdDecimal ?? "?"})`,
      `SETTLEMENT_KEY = marketKey(yesId) = yesId >> 8 = (uint160(pool) << 64) | nonce — what BinarySettlement.getSettlement() takes; derived in-tx from module.markets(marketId).yesId, never stored`,
      `marketId ≠ marketKey (e.g. ${first?.marketIdDecimal ?? "?"} vs ${first?.key ?? "?"}); contracts store bytes32 marketId only and re-derive pool/nonce/outcome ids from the module record`,
      failures.length === 0 ? "all identity checks passed" : `FAILED checks: ${failures.join("; ")}`,
    ]),
  );
  if (failures.length > 0) process.exitCode = 1;
});
