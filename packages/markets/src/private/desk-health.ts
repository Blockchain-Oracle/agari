import type { PrivateStatus } from "@masayume/core/private";
import type { Address } from "@masayume/core/types";
import { MULTICALL3_ADDRESS, SOMNIA_SHANNON_ID } from "../chain";
import { privateDeskAbi } from "../contracts/private-desk.abi";
import { getPrivateDeployment } from "../runtime/read-runtime";
import { requiredGasWei } from "../submitter/gas";
import type { DeskClient } from "./desk-client";

/** An open is three sends from the desk key, a cash-out three more; the key must cover an open before it starts one. */
const OPEN_SENDS = 3n;

/** Whether the private route can run right now, and every reason it cannot — for the control that must never silently do nothing. */
export async function deskHealth(desk: DeskClient | null): Promise<PrivateStatus> {
  const deployment = getPrivateDeployment();
  const reasons: string[] = [];
  const base: PrivateStatus = { ready: false, reasons, mode: "desk-signed-slot", desk: null, contract: deployment?.privateDesk ?? null, chainId: SOMNIA_SHANNON_ID, minStakeBase: null, maxStakeBase: null, paused: false };
  if (!deployment) reasons.push("PrivateDesk is not deployed on this network yet");
  if (!desk) reasons.push("no desk key is configured on this deployment (PRIVATE_DESK_PRIVATE_KEY)");
  if (!deployment || !desk) return base;

  const c = { address: deployment.privateDesk, abi: privateDeskAbi } as const;
  try {
    const [pinned, paused, params] = await desk.publicClient.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...c, functionName: "desk" },
        { ...c, functionName: "paused" },
        { ...c, functionName: "params" },
      ],
    });
    const stt = await desk.publicClient.getBalance({ address: desk.address });
    const p = params as readonly [bigint, bigint, number];
    if ((pinned as Address).toLowerCase() !== desk.address.toLowerCase()) reasons.push("the configured desk key is not the one the contract pins");
    if (paused) reasons.push("Private mode is paused on the contract");
    if (stt < requiredGasWei("private") * OPEN_SENDS) reasons.push("the desk key holds too little STT to place a bet");
    return { ...base, ready: reasons.length === 0, desk: pinned as Address, minStakeBase: p[0].toString(), maxStakeBase: p[1].toString(), paused };
  } catch {
    reasons.push("the desk could not read the contract right now");
    return base;
  }
}
