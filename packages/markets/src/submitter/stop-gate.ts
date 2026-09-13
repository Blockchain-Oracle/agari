import type { StopGate } from "@masayume/core/ports";

const ALLOW_ALL_RESERVATION = "allow-all";

/** The Daily-Stop seam (AD-9): a named step of the order lane from day one, allow-all until the Stop service exists (Story 5.2). */
export const allowAllStopGate: StopGate = {
  async checkAndReserve() {
    return { ok: true, reservationId: ALLOW_ALL_RESERVATION };
  },
  async reconcile() {},
};
