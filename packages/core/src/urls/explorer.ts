import { SHANNON_EXPLORER_URL } from "../constants/chain";
import type { Address, Hex } from "../types/primitives";

export function txUrl(hash: Hex, explorerBase: string = SHANNON_EXPLORER_URL): string {
  return `${explorerBase}/tx/${hash}`;
}

export function addressUrl(address: Address, explorerBase: string = SHANNON_EXPLORER_URL): string {
  return `${explorerBase}/address/${address}`;
}
