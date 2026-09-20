import { CLUSTER_ID, DEFAULT_CLUSTER } from "@agari/core/constants";
import type { PrivateStatus } from "@agari/core/private";
import type { Address } from "@agari/core/types";
import type { DeskClient } from "./desk-client";
import { DESK_OPEN_LAMPORTS } from "./desk-open";
import { readDesk } from "./reads";

/** Whether the private route can run right now, and every reason it cannot, so the control never silently does nothing. */
export async function deskHealth(desk: DeskClient | null): Promise<PrivateStatus> {
  const reasons: string[] = [];
  const base: PrivateStatus = { ready: false, reasons, mode: "desk-signed-slot", desk: null, contract: null, chainId: desk?.chainId ?? CLUSTER_ID[DEFAULT_CLUSTER], minStakeBase: null, maxStakeBase: null, paused: false };
  try {
    const state = await readDesk();
    if (!state) reasons.push("There is no private desk on this network yet");
    if (!desk) reasons.push("no desk key is configured on this deployment (PRIVATE_DESK_PRIVATE_KEY)");
    if (!state || !desk) return { ...base, contract: state?.address ?? null };

    const pinned = state.data.desk as string as Address;
    const lamports = (await desk.client.rpc.getBalance(desk.signer.address).send()).value;
    if (pinned !== desk.address) reasons.push("the configured desk key is not the one the chain pins");
    if (state.data.paused) reasons.push("Private mode is paused on chain");
    if (lamports < DESK_OPEN_LAMPORTS) reasons.push("the desk key holds too little SOL to place a bet");
    return { ...base, ready: reasons.length === 0, desk: pinned, contract: state.address, minStakeBase: state.data.params.minStakeBase.toString(), maxStakeBase: state.data.params.maxStakeBase.toString(), paused: state.data.paused };
  } catch {
    reasons.push("the desk could not read the chain right now");
    return base;
  }
}
