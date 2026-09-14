#!/usr/bin/env -S pnpm exec tsx
// Writes the real RedStone TSLA print fixture (anchor/tests/vectors/prints/README.md) from an archived boundary:
//   redstone-tsla-<T>.json  the TSLA gateway packages at T (values as exact decimal strings) + derived facts
//   redstone-tsla-<T>.hex   the wire payload, built by the same code the relay and the drive use
// Run: pnpm exec tsx scripts/fixtures/redstone-tsla.ts <archive.jsonl> <T>

import { readFileSync, writeFileSync } from "node:fs";
import { decimalToE8, packagesAt, parseGatewayJson, redstoneMedianE8, redstonePayload } from "@agari/markets/deploy";

const [archivePath, tArg] = process.argv.slice(2);
if (!archivePath || !tArg) throw new Error("usage: redstone-tsla.ts <archive.jsonl> <T>");
const tSec = Number(tArg);

const line = readFileSync(archivePath, "utf8").split("\n").find((l) => l.startsWith(`{"T":${tSec},`));
if (!line) throw new Error(`no archived boundary at T = ${tSec}`);
// The archive line keeps the gateway's feeds verbatim under `feeds`; parse with exact decimals.
const { feeds } = parseGatewayJson(line) as unknown as { feeds: Parameters<typeof packagesAt>[0] };
const packages = packagesAt(feeds, "TSLA", tSec);
if (packages.length !== 5) throw new Error(`expected 5 TSLA signers at ${tSec}, got ${packages.length}`);

const payload = redstonePayload(packages, "TSLA");
const valuesE8 = packages.map((p) => decimalToE8(String(p.dataPoints[0]!.value)));
const out = "anchor/tests/vectors/prints";
writeFileSync(`${out}/redstone-tsla-${tSec}.hex`, `${Buffer.from(payload).toString("hex")}\n`);
writeFileSync(
  `${out}/redstone-tsla-${tSec}.json`,
  `${JSON.stringify(
    {
      T: tSec,
      iso: new Date(tSec * 1000).toISOString(),
      source: `${archivePath.replace(/^(\.\.\/)+[^/]+\//, "")} (gateway historical endpoint, redstone-primary-prod)`,
      payloadBytes: payload.length,
      signers: packages.map((p) => p.signerAddress.toLowerCase()),
      valuesE8: valuesE8.map(String),
      medianE8: String(redstoneMedianE8(valuesE8)),
      packages,
    },
    null,
    2,
  )}\n`,
);
console.log(`redstone-tsla-${tSec}: ${packages.length} signers, ${payload.length} B, median ${redstoneMedianE8(valuesE8)}e-8`);
