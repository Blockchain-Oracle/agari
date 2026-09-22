import type { TickerSymbol } from "@agari/core/market";
import type { Reading } from "@agari/core/schemas";
import { formatBaseUnits, formatUtc, secToMs } from "@agari/core/units";
import { getDb, isDbConfigured } from "@agari/db";
import { marketsProvider, syncClock } from "@agari/markets";
import { createFaucetService } from "@/features/funding/faucet-service.server";
import { faucetConfig } from "@/features/funding/faucet-config.server";
import { missingCredentialHint, resolveModel } from "@/features/sensei/model.server";
import { STATUS } from "./copy";
import { createDiagnosticRunner, DiagnosticFailure } from "./diagnostic-runner";
import { gradeFaucet } from "./grade";
import { errorText, notConfiguredRow, pipelineRow } from "./pipeline";
import type { StatusPipeline } from "./protocol";
import { gameSponsorStatus } from "@/features/games/sponsor.server";

/**
 * The probes behind `/api/status` — server only.
 *
 * Each one is a real read made when the page asks, bounded by its own timeout so one
 * dead dependency cannot hang the others, and each reports what it actually saw.
 * The port's reads keep a last-good value and flip `stale` when a refresh fails;
 * on a status page that is exactly the wrong thing to show as green, so a stale
 * reading counts as a failed probe here and says which reading it is holding.
 */
export const PRICE_ASSETS_CAP = 4;
// Every probe gets 10s; they run alongside one another, keeping the route below its 30s platform allowance.
const diagnose = createDiagnosticRunner(10_000);
/** Balances move by claims and refills, not by the second: one chain read a minute however many viewers poll. */
const FAUCET_REUSE_MS = 60_000;
const LAMPORT_DECIMALS = 9;

function fresh<T>(reading: Reading<T>): T {
  if (!reading.ok) throw new Error(reading.error.technical || reading.error.kind);
  if (reading.stale) throw new Error(STATUS.detail.stale(formatUtc(reading.asOfMs)));
  return reading.value;
}

function down(id: string, label: string, detail: string, optional = false, configured = true, latencyMs: number | null = null): StatusPipeline {
  return { id, label, ok: false, lagSec: null, latencyMs, detail, optional, configured, expected: false, grade: null };
}

const elapsed = (error: unknown) => error instanceof DiagnosticFailure ? error.elapsedMs : null;

export async function probeRpc(): Promise<{ pipeline: StatusPipeline; slot: number | null }> {
  const label = STATUS.pipelines.rpc;
  try {
    const clock = await diagnose("rpc", ({ step }) => step("RPC chain head", async () => fresh(await syncClock())));
    const { slot, rttMs, offsetMs } = clock.value;
    // Block times are whole seconds, so a head a second "behind" is normal; one minutes
    // behind is a chain that stopped, not a slow socket.
    const lagSec = Math.max(0, Math.round(-offsetMs / 1000));
    const offsetText = `${offsetMs >= 0 ? "+" : "−"}${(Math.abs(offsetMs) / 1000).toFixed(1)}`;
    return {
      pipeline: { id: "rpc", label, ok: true, lagSec, latencyMs: rttMs, detail: STATUS.detail.rpc(slot.toLocaleString("en-US"), offsetText), optional: false, configured: true, expected: false, grade: null },
      slot,
    };
  } catch (error) {
    return { pipeline: down("rpc", label, errorText(error), false, true, elapsed(error)), slot: null };
  }
}

/** The one real "time lag" here: how old the feed's latest print is against the wall clock. Session-bound. */
export async function probePrice(asset: TickerSymbol, nowMs: number, inSession: boolean): Promise<StatusPipeline> {
  const id = `price:${asset}`;
  const label = STATUS.pipelines.price(asset);
  try {
    const result = await diagnose(id, ({ step }) => step(`${asset} latest price`, async () => fresh(await marketsProvider.getAssetPrice(asset))));
    const price = result.value;
    if (price === null) return pipelineRow(id, label, { verdict: inSession ? "bad" : "good", detail: STATUS.detail.noPrint, latencyMs: result.elapsedMs, offHours: !inSession });
    const printedMs = secToMs(price.publishTimeSec);
    const lagSec = Math.max(0, Math.round((nowMs - printedMs) / 1000));
    const priceText = `$${formatBaseUnits(price.priceRaw, price.decimals)}`;
    return pipelineRow(id, label, { verdict: "good", ladder: true, lagSec, latencyMs: result.elapsedMs, detail: STATUS.detail.price(priceText, formatUtc(printedMs)), offHours: !inSession });
  } catch (error) {
    return down(id, label, errorText(error), false, true, elapsed(error));
  }
}

/** Required on Agari: the index and the print archive live in the same database as the social store. */
export async function probeStore(): Promise<StatusPipeline> {
  const label = STATUS.pipelines.store;
  if (!isDbConfigured()) return down("store", label, STATUS.detail.storeOff);
  try {
    const db = getDb();
    if (!db) return down("store", label, STATUS.detail.storeOff);
    const result = await diagnose("store", ({ step }) => step("Database read", async () => db`select 1`));
    return pipelineRow("store", label, { verdict: "good", detail: STATUS.detail.storeOk, latencyMs: result.elapsedMs, ladder: true });
  } catch (error) {
    return down("store", label, STATUS.detail.storeDown(errorText(error)), false, true, elapsed(error));
  }
}

/** Which model would answer — never a key, only the route it would take. */
export function probeSensei(): StatusPipeline {
  const label = STATUS.pipelines.sensei;
  try {
    const model = resolveModel();
    if (!model) return down("sensei", label, STATUS.detail.senseiOff(missingCredentialHint()), true, false);
    return pipelineRow("sensei", label, { verdict: "good", detail: STATUS.detail.senseiOk(model.providerName, model.modelId, model.via), optional: true, ladder: true });
  } catch (error) {
    return down("sensei", label, errorText(error), true, true);
  }
}

let faucetMemo: { atMs: number; row: Promise<StatusPipeline> } | null = null;

async function readFaucet(): Promise<StatusPipeline> {
  const label = STATUS.pipelines.faucet;
  const config = faucetConfig();
  if (!config?.enabled) return notConfiguredRow("faucet", label, STATUS.detail.faucetOff);
  try {
    const { value: status, elapsedMs } = await diagnose("faucet", ({ step }) => step("Faucet balances", () => createFaucetService(config.chain).status(null)));
    const funding = BigInt(status.fundingBalanceLamports ?? "0");
    const solLeft = BigInt(status.dailyRemainingLamports ?? "0");
    const tusdc = status.tusdc;
    const tusdcLeft = tusdc.configured && tusdc.dailyRemainingBase !== null && tusdc.decimals !== null ? formatBaseUnits(BigInt(tusdc.dailyRemainingBase), tusdc.decimals, { maxDp: 0, minDp: 0 }) : null;
    const detail = STATUS.detail.faucet(formatBaseUnits(funding, LAMPORT_DECIMALS), formatBaseUnits(solLeft, LAMPORT_DECIMALS), tusdcLeft);
    return pipelineRow("faucet", label, { verdict: gradeFaucet(status.ready, tusdc.ready, funding), detail, latencyMs: elapsedMs });
  } catch (error) {
    return down("faucet", label, errorText(error), false, true, elapsed(error));
  }
}

/** The faucet's SOL and tUSDC budget, reused for a minute (a failed read is not kept). Not session-bound. */
export function probeFaucet(nowMs = Date.now()): Promise<StatusPipeline> {
  if (faucetMemo && nowMs - faucetMemo.atMs < FAUCET_REUSE_MS) return faucetMemo.row;
  const row = readFaucet();
  const memo = { atMs: nowMs, row };
  faucetMemo = memo;
  void row.then((pipeline) => {
    if (!pipeline.ok && faucetMemo === memo) faucetMemo = null;
  });
  return row;
}

/** Capabilities that arrive in later stages, shown as the reference shows an unconfigured option. */
export const switchboardRow = () => notConfiguredRow("switchboard", STATUS.pipelines.switchboard, STATUS.detail.switchboard);
/**
 * The game sponsor's budget: the key's SOL against the widest deck's envelope, from the same read `/api/games/sponsor`
 * serves. This row was a stub that said "arrives in S7" long after S7 shipped the sponsor, so /status called a funded,
 * co-signing sponsor "no sponsor on this deployment yet".
 */
export async function sponsorRow(): Promise<StatusPipeline> {
  const label = STATUS.pipelines.sponsor;
  try {
    const { value: status, elapsedMs } = await diagnose("sponsor", ({ step }) => step("Sponsor balance", () => gameSponsorStatus()));
    if (!status.configured) return notConfiguredRow("sponsor", label, STATUS.detail.sponsorOff);
    const balance = formatBaseUnits(BigInt(status.balanceWei ?? "0"), LAMPORT_DECIMALS);
    const envelope = formatBaseUnits(BigInt(status.deckEnvelopeWei), LAMPORT_DECIMALS);
    const detail = STATUS.detail.sponsor(balance, envelope, status.ready);
    if (!status.ready) return down("sponsor", label, detail, false, true, elapsedMs);
    return pipelineRow("sponsor", label, { verdict: "good", detail, latencyMs: elapsedMs });
  } catch (error) {
    return down("sponsor", label, errorText(error), false, true, elapsed(error));
  }
}
