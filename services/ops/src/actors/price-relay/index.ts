/**
 * price-relay (plan §4; venue-ops.md §6): records signed prints into Window slots, archives every boundary, sweeps
 * leftover Pyth update accounts, and runs the process's spot feed. One key (`price-relay`), one writer.
 */
import { generateKeyPairSync } from "node:crypto";
import { createOpsClient } from "@agari/markets/ops";
import { closeLeftoverPriceUpdates, findPriceUpdates, readClusterTag } from "@agari/markets/ops/prints";
import { createSpotFeed, type SpotFeedHandle } from "../../prices/spot-feed";
import { runActor } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { roleSecret } from "../../runtime/keys";
import { archivePass } from "./archive-pass";
import { BoundaryCache } from "./boundary-cache";
import { relayPass, type RelayContext } from "./relay-pass";
import { loadRelaySources } from "./sources";
import { VenueTracker } from "./tracker";

export interface PriceRelayHandle {
  /** The process's spot feed: hand it to the seed maker and the HTTP server. */
  spot: SpotFeedHandle;
  stop(): void;
}

const LEFTOVER_EVERY_MS = 60 * 60_000;

/** A throwaway identity for reads when the role key is missing: it is never funded and nothing is signed with it. */
function readOnlySecret(): Uint8Array {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const d = Buffer.from(privateKey.export({ format: "jwk" }).d!, "base64url");
  const x = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return Uint8Array.from([...d, ...x]);
}

export async function startPriceRelay(deps: VenueDeps): Promise<PriceRelayHandle> {
  const { env, log, sessions } = deps;
  const sources = loadRelaySources();
  const pythKey = process.env.PYTH_API_KEY || undefined;
  const cache = new BoundaryCache(sources, pythKey);
  const spot = createSpotFeed({ sources, pythKey, log: (why) => log(`[spot] ${why}`) });
  spot.start();
  const stops: Array<() => void> = [spot.stop];

  const archive = { sources, cache, sessions, pythEnabled: Boolean(pythKey), unavailable: new Set<string>(), counters: { redstoneRows: 0, pythRows: 0, unavailable: 0 }, log };
  stops.push(runActor({ name: "price-archive", log: (why) => log(`[archive] ${why}`), dryRun: false, everyMs: 10_000, pass: () => archivePass(archive) }).stop);

  const secret = roleSecret("price-relay");
  if (!secret) log("PRICE_RELAY_PRIVATE_KEY is not set: scanning and reporting only (DRY), nothing is signed");
  const dryRun = env.dryRun || !secret;
  const payerSecret = secret ?? readOnlySecret();
  // Prints have the tightest deadlines (RedStone checks by T + 120), so the relay paces in the reserved priority lane.
  const client = await createOpsClient({ rpcUrl: env.rpcUrl, rpcSubscriptionsUrl: env.rpcSubscriptionsUrl, payerSecret, rpcLane: "priority" });
  const attestorSecret = process.env.RELAY_ATTESTED === "1" ? roleSecret("price-attestor") : null;
  if (process.env.RELAY_ATTESTED === "1" && !attestorSecret) log("RELAY_ATTESTED=1 but PRICE_ATTESTOR_PRIVATE_KEY is not set: attested slots stay unrecorded");
  const ctx: RelayContext = {
    client, rpcUrl: env.rpcUrl, payerSecret, dryRun, sources, cache, tracker: new VenueTracker(client), log,
    attested: attestorSecret ? { attestorSecret, clusterTag: await readClusterTag(client) } : null,
    failures: new Map(), missed: new Set(),
    counters: { recorded: 0, already: 0, failed: 0, missed: 0, pythPosted: 0, pythClosed: 0 },
  };
  log(`relay key ${client.payer.address}${dryRun ? " (DRY RUN: nothing is signed)" : ""}; RedStone ${sources.redstoneFeeds.length} feeds via ${sources.gateways.join(", ")}; Pyth ${pythKey ? `${sources.pythFeeds.length} trial feeds` : "off (no PYTH_API_KEY)"}`);
  stops.push(runActor({ name: "price-relay", log, dryRun, everyMs: 3_000, pass: () => relayPass(ctx) }).stop);
  stops.push(
    runActor({
      name: "pyth-leftovers",
      log: (why) => log(`[leftovers] ${why}`),
      dryRun,
      everyMs: LEFTOVER_EVERY_MS,
      pass: async () => {
        if (dryRun) return { why: `DRY ${(await findPriceUpdates(client, client.payer.address)).length} leftover PriceUpdateV2 accounts would be closed` };
        const { found, signatures } = await closeLeftoverPriceUpdates({ client, rpcUrl: env.rpcUrl, payerSecret });
        return { why: found.length ? `closed ${found.length} leftover PriceUpdateV2 accounts (${signatures.length} txs)` : "no leftover PriceUpdateV2 accounts", detail: { lastFound: found.length } };
      },
    }).stop,
  );
  return { spot, stop: () => stops.forEach((stop) => stop()) };
}
