import { err, type ReadingErr } from "@agari/core/schemas";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";

/**
 * The one honest answer the S1 stub gives for anything that needs the chain (D-015).
 *
 * `@agari/markets` keeps Masayume's export map and hook names, but until `agari-events` is deployed (S2) and the
 * Solana adapter lands (S4) there is no market, book, print, balance or clock to read. Every chain read returns
 * this diagnosis instead of a fabricated value, and every write is refused with it before anything is signed.
 */
export const NOT_DEPLOYED_TECHNICAL = "agari-events not deployed yet (S1 stub)";

export function notDeployed(technical: string = NOT_DEPLOYED_TECHNICAL): Diagnosis {
  return diagnosis("not-deployed", technical);
}

export function notDeployedReading(technical?: string): ReadingErr {
  return err(notDeployed(technical));
}

/** For the few reads whose contract is a plain promise rather than a `Reading`: `diagnose()` passes this through intact. */
export function notDeployedError(technical?: string): ReadingError {
  return new ReadingError(notDeployed(technical));
}
