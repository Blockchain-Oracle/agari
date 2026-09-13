import { computeTraderEdge, reputationOf, computeBadges, type Address } from "@masayume/core";
import { bootMarkets, marketsProvider } from "@masayume/markets";
import { runSpike, short } from "./lib/boot";

const WALLET = (process.env.WALLET ?? "0xe11825b13c96ccbe49cff978932375ce13daaeb4") as Address;
const json = (value: unknown): string => JSON.stringify(value, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);

/** The provider end to end: one reading, timed, and the report it feeds. */
await runSpike(async ({ env }) => {
  const boot = await bootMarkets(env);
  if (!boot.ok) throw new Error(boot.error.kind);
  let t0 = Date.now();
  const first = await marketsProvider.listWalletHistory(WALLET);
  console.log(`first read: ${Date.now() - t0}ms · ok=${first.ok}`);
  if (!first.ok) { console.log(json(first.error)); return; }
  t0 = Date.now();
  const second = await marketsProvider.listWalletHistory(WALLET);
  console.log(`second read (finalized rows + fees cached): ${Date.now() - t0}ms · ok=${second.ok}`);
  const h = first.value;
  console.log(`rounds ${h.rounds.length} · open ${h.openCount} · fills ${h.fillCount} · complete ${h.complete} · decimals ${h.decimals}`);
  console.log("outcomes:", json(Object.fromEntries(["win", "loss", "void", "closed"].map((o) => [o, h.rounds.filter((r) => r.outcome === o).length]))));
  console.log("claims:", json(Object.fromEntries(["paid", "to-collect", "none", "unknown"].map((c) => [c, h.rounds.filter((r) => r.claim === c).length]))));
  console.log("newest round:", json({ ...h.rounds[0], marketId: short(h.rounds[0]?.marketId ?? "") }));
  const edge = computeTraderEdge(h.rounds, h.openCount);
  console.log("edge:", json({ ...edge, equity: edge.equity.length, windows: edge.windows.map((w) => `${w.key}:${w.count}/${w.netBase}`) }));
  const decided = edge.wins + edge.losses;
  console.log("reputation:", json(reputationOf(decided, edge.wins, edge.currentWinStreak)));
  console.log("badges:", json(computeBadges({ fillCount: h.fillCount, currentWinStreak: edge.currentWinStreak, stakeBase: edge.stakeBase, decidedRounds: decided, winRate: decided ? edge.wins / decided : 0, decimals: h.decimals , lpSharesRaw: null })));
});
