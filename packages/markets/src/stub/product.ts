import { ok, type Reading } from "@agari/core/schemas";
import type { Diagnosis } from "@agari/core/types";
import { nowMs } from "../provider/clock";
import { notDeployed, notDeployedReading } from "./not-deployed";

/**
 * The shapes a product read or write takes on a cluster where its program isn't deployed yet. Masayume renders each
 * of these already (`CapabilityPending`, empty lists, zero balances), so S1 reuses them rather than inventing states.
 */
export const absent = <T>(value: T): Promise<Reading<T>> => Promise.resolve(ok(value, nowMs()));

/** A read whose honest answer needs the program itself (a quote, a preview): the product's own not-deployed reason. */
export const unavailableFor = <T>(reason: string): Promise<Reading<T>> => Promise.resolve(notDeployedReading(reason));

/** Every product write outcome shares this arm. Nothing is journaled or signed. */
export const refusedFor = (reason: string): { status: "refused"; diagnosis: Diagnosis } => ({ status: "refused", diagnosis: notDeployed(reason) });
