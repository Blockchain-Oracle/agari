#!/usr/bin/env -S pnpm exec tsx
// Surfpool only: loads a Series' accounts into the fork in two batched reads so the fork holds one consistent snapshot
// of them (Surfpool fetches lazily on first touch; a live venue's roller and settler rebind Books every cadence, so a
// Series read at t and its Books at t + 30 s can disagree). Run at a quiet moment of the cadence, before a drive.
// Run: SURFPOOL_PORT=8899 pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/prewarm-fork.ts [--series TSLA-5m,TEST-ATT-5m]
import { createDeployClient, type VenueRecord } from "@agari/markets/deploy";
import { arg, endpoints, readJson, roleSecret } from "../deploy/ops-cluster";

const DEFAULT = "11111111111111111111111111111111";
const keys = arg("--series", "TSLA-5m,TEST-ATT-5m").split(",");
const venue = readJson<{ venue: VenueRecord }>("scripts/deploy/addresses.devnet.json").venue;
const { rpcUrl, rpcSubscriptionsUrl } = endpoints("localnet");
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
type Address = Parameters<typeof client.agariEvents.accounts.book.fetchAll>[0][number];
const first: Address[] = [];
for (const key of keys) {
  const s = venue.series?.[key];
  if (!s) throw new Error(`${key} is not in the venue record`);
  first.push(s.address as Address, ...(s.books as Address[]));
}
const books = await client.agariEvents.accounts.book.fetchAll(first.filter((a) => !keys.some((k) => venue.series![k]!.address === a)));
const markets = books.map((b) => b.data.market).filter((m) => m !== DEFAULT);
const second = markets.length ? await client.agariEvents.accounts.market.fetchAll(markets) : [];
const ledgers = second.map((m) => m.data.ledger);
if (ledgers.length) await client.rpc.getMultipleAccounts(ledgers, { encoding: "base64" }).send();
console.log(`prewarmed ${first.length} series/book, ${markets.length} market, ${ledgers.length} ledger accounts on ${rpcUrl}`);
for (const b of books) console.log(`  book ${b.address} → market ${b.data.market}, orders ${b.data.orderCount}`);
