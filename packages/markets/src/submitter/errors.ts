import type { Diagnosis, Quote } from "@masayume/core/types";

/** A pre-send step refused the order; the lane turns it into a `refused` outcome with this diagnosis. */
export class OrderRefusedError extends Error {
  constructor(readonly diagnosis: Diagnosis) {
    super(diagnosis.technical);
    this.name = "OrderRefusedError";
  }
}

/** The fresh quote breached the confirmed cap; the lane surfaces the new quote instead of sending (FR-9). */
export class RequoteError extends Error {
  constructor(readonly quote: Quote) {
    super("fresh quote exceeds the confirmed max cost");
    this.name = "RequoteError";
  }
}
