// Real price data for the drive: Pyth trial updates from Hermes and RedStone packages from the public gateway, both at
// an exact boundary T. Server-only: PYTH_API_KEY comes from the env and is never printed.

import { packagesAt, parseGatewayJson, redstoneHistoricalUrl, type RedStonePackage } from "@agari/markets/deploy";

const HERMES = "https://hermes.pyth.network";
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const wallSec = () => Math.floor(Date.now() / 1000);

export type PythAtT = { updatesBase64: string[]; price: bigint; expo: number; publishTime: number };

/** `GET /v2/updates/price/{T}` for one feed; retries until Hermes has the update or `giveUpSec` passes. */
export async function pythUpdateAt(tSec: number, feedIdHex: string, giveUpSec = 60): Promise<PythAtT> {
  const key = process.env.PYTH_API_KEY;
  if (!key) throw new Error("PYTH_API_KEY is not set (Pyth trial, server-only)");
  const url = `${HERMES}/v2/updates/price/${tSec}?ids[]=${feedIdHex}&encoding=base64&parsed=true`;
  const deadline = wallSec() + giveUpSec;
  for (;;) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const body = (await res.json()) as { binary: { data: string[] }; parsed: Array<{ price: { price: string; expo: number; publish_time: number } }> };
      const parsed = body.parsed[0]!.price;
      return { updatesBase64: body.binary.data, price: BigInt(parsed.price), expo: parsed.expo, publishTime: parsed.publish_time };
    }
    if (wallSec() > deadline) throw new Error(`Hermes has no update at ${tSec} (HTTP ${res.status})`);
    await sleep(2_000);
  }
}

/** The single-feed packages at exactly T, retrying until `min` distinct signers are present or `giveUpSec` passes. */
export async function redstoneAt(tSec: number, feed: string, min = 5, giveUpSec = 60): Promise<RedStonePackage[]> {
  const deadline = wallSec() + giveUpSec;
  let last: RedStonePackage[] = [];
  for (;;) {
    const res = await fetch(redstoneHistoricalUrl(tSec));
    if (res.ok) {
      last = packagesAt(parseGatewayJson(await res.text()), feed, tSec);
      if (last.length >= min) return last;
    }
    if (wallSec() > deadline) {
      if (last.length >= 3) return last;
      throw new Error(`RedStone gateway has ${last.length} ${feed} packages at ${tSec} (HTTP ${res.status})`);
    }
    await sleep(3_000);
  }
}

/** Blocks until the wall clock reaches `tSec`, logging once. */
export async function waitUntil(tSec: number, why: string) {
  const wait = tSec - wallSec();
  if (wait <= 0) return;
  console.log(`  … waiting ${wait} s for ${why} (${new Date(tSec * 1000).toISOString()})`);
  await sleep(wait * 1000);
}

/** Surfpool only: moves the chain clock forward to `tSec` (no-op when it is already there). */
export async function timeTravel(rpcUrl: string, tSec: number) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "surfnet_timeTravel", params: [{ absoluteTimestamp: tSec * 1000 }] }),
  });
  const body = (await res.json()) as { error?: { message: string } };
  if (body.error) throw new Error(`surfnet_timeTravel: ${body.error.message}`);
}
