/**
 * Recording prints into slots (prints.md §4): RedStone and attested one slot per transaction; Pyth posts a boundary's
 * accumulator update once, records every slot that reads it, then closes every account it posted.
 */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  findConfigPda,
  getPublicRecordPrintAttestedInstructionAsync,
  getPublicRecordPrintPythInstruction,
  getPublicRecordPrintRedstoneInstructionAsync,
} from "@agari/clients/agari-events";
import { address, type Address, type KeyPairSigner } from "@solana/kit";
import { eventAuthority } from "../../deploy/cycle/accounts";
import { attestedMessage, ed25519Instruction } from "../../prices/attested";
import { closePythUpdates, postPythUpdates } from "../../prices/legacy";
import { redstonePayload, type RedStonePackage } from "../../prices/redstone";
import type { OpsClient } from "../client";
import { ENGINE_ERROR, OpsSendError, sendOps } from "../send";
import type { PrintSlot } from "./slots";

export type SlotStatus = "recorded" | "already" | "early" | "late" | "failed";

export interface SlotOutcome {
  slot: PrintSlot;
  status: SlotStatus;
  signature?: string;
  code?: number | null;
  error?: string;
}

const label = (s: PrintSlot) => `${s.source} ${s.slot} ${s.seriesKey} #${s.marketIndex}`;

function outcomeOf(slot: PrintSlot, error: unknown): SlotOutcome {
  const code = error instanceof OpsSendError ? error.code : null;
  const message = error instanceof Error ? error.message : String(error);
  if (code === ENGINE_ERROR.printAlreadyRecorded || code === ENGINE_ERROR.marketAlreadyTerminal) return { slot, status: "already", code };
  if (code === ENGINE_ERROR.printTooEarly) return { slot, status: "early", code, error: message };
  if (code === ENGINE_ERROR.printTooLate) return { slot, status: "late", code, error: message };
  return { slot, status: "failed", code, error: message };
}

async function sendSlot(client: OpsClient, slot: PrintSlot, build: () => Promise<Parameters<typeof sendOps>[1]>): Promise<SlotOutcome> {
  try {
    const { signature } = await sendOps(client, await build(), label(slot));
    return { slot, status: "recorded", signature };
  } catch (error) {
    return outcomeOf(slot, error);
  }
}

/** `packages` must be single-feed, at exactly T, one per configured signer (`packagesAt` + a signer filter). */
export function recordRedstoneSlot(client: OpsClient, slot: PrintSlot, packages: RedStonePackage[]): Promise<SlotOutcome> {
  if (!slot.redstoneFeed) return Promise.resolve({ slot, status: "failed", error: "not a RedStone slot" });
  const feed = slot.redstoneFeed;
  return sendSlot(client, slot, async () => [
    await getPublicRecordPrintRedstoneInstructionAsync({
      series: address(slot.series), market: address(slot.market), eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS,
      which: slot.which, payload: redstonePayload(packages, feed),
    }),
  ]);
}

export type AttestedSlotInput = { attestor: KeyPairSigner; clusterTag: number; priceE8: bigint; fetchedAtSec: number };

/** `[ed25519 over the 158 B message, public_record_print_attested]`, the precompile first (D-027). */
export function recordAttestedSlot(client: OpsClient, slot: PrintSlot, input: AttestedSlotInput): Promise<SlotOutcome> {
  const market = address(slot.market);
  const feedId = Uint8Array.from(slot.feedIdHex.match(/../g)!.map((b) => Number.parseInt(b, 16)));
  return sendSlot(client, slot, async () => {
    const message = attestedMessage({
      programId: AGARI_EVENTS_PROGRAM_ADDRESS, clusterTag: input.clusterTag, market, which: slot.which, boundaryTs: BigInt(slot.boundarySec),
      price: input.priceE8, expo: -8, feedId, barLenSec: slot.barLenSec, fetchedAtTs: BigInt(input.fetchedAtSec),
    });
    return [
      await ed25519Instruction(input.attestor, message, 0xffff),
      await getPublicRecordPrintAttestedInstructionAsync({
        series: address(slot.series), market, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, which: slot.which,
        price: input.priceE8, expo: -8, barStartTs: BigInt(slot.boundarySec - slot.barLenSec), fetchedAtTs: BigInt(input.fetchedAtSec),
      }),
    ];
  });
}

export type PythBoundaryInput = {
  client: OpsClient;
  /** For the receiver SDK (web3.js 1): the same key as `client`. May carry a provider key: never log it. */
  rpcUrl: string;
  payerSecret: Uint8Array;
  /** Slots of one boundary T, all Pyth. */
  slots: PrintSlot[];
  /** Hermes `/v2/updates/price/{T}` `binary.data`. */
  updatesBase64: string[];
  /** Records in parallel up to this many at once (default 4). */
  concurrency?: number;
};

export type PythBoundaryResult = { outcomes: SlotOutcome[]; posted: string[]; postSignatures: string[]; closeSignatures: string[]; closeError?: string };

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

/** Post once → record each slot from its feed's account → close every posted account, even when records fail. */
export async function recordPythBoundary(input: PythBoundaryInput): Promise<PythBoundaryResult> {
  const posted = await postPythUpdates({ rpcUrl: input.rpcUrl, payerSecret: input.payerSecret, updatesBase64: input.updatesBase64 });
  const accountOf = new Map(posted.priceUpdates.map((u) => [u.feedIdHex, u.address]));
  const outcomes = await inBatches(input.slots, input.concurrency ?? 4, (slot) => {
    const account = accountOf.get(slot.feedIdHex);
    if (!account) return Promise.resolve<SlotOutcome>({ slot, status: "failed", error: `Hermes update has no feed ${slot.feedIdHex.slice(0, 8)}…` });
    return sendSlot(input.client, slot, async () => [
      getPublicRecordPrintPythInstruction({
        series: address(slot.series), market: address(slot.market), priceUpdate: address(account), eventAuthority: await eventAuthority(),
        program: AGARI_EVENTS_PROGRAM_ADDRESS, which: slot.which,
      }),
    ]);
  });
  const addresses = posted.priceUpdates.map((u) => u.address);
  const result: PythBoundaryResult = { outcomes, posted: addresses, postSignatures: posted.signatures, closeSignatures: [] };
  try {
    result.closeSignatures = await closePythUpdates({ rpcUrl: input.rpcUrl, payerSecret: input.payerSecret, addresses });
  } catch (error) {
    result.closeError = error instanceof Error ? error.message : String(error);
  }
  return result;
}

export { inBatches };

/** The GlobalConfig cluster tag attested messages bind (D-012). */
export async function readClusterTag(client: OpsClient): Promise<number> {
  const [config] = await findConfigPda();
  return (await client.agariEvents.accounts.globalConfig.fetch(config as Address)).data.clusterTag;
}
