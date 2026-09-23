import { DeviceEventEmitter } from "react-native";
import { CREDITED_EVENT, OPEN_FUNDS_EVENT } from "@/features/funding/copy";

/** Stands in for web/src/features/funding/credited.ts: the same announcements over the app's event emitter. */
export interface CreditedDetail {
  amountText: string;
  symbol: string;
  firstTime: boolean;
}

const WELCOMED_KEY = (address: string) => `agari.welcomed.${address}`;

export function announceCredit(address: string, amountText: string, symbol: string): void {
  const firstTime = !localStorage.getItem(WELCOMED_KEY(address));
  if (firstTime) localStorage.setItem(WELCOMED_KEY(address), "1");
  DeviceEventEmitter.emit(CREDITED_EVENT, { amountText, symbol, firstTime } satisfies CreditedDetail);
}

export function openFunds(): void {
  DeviceEventEmitter.emit(OPEN_FUNDS_EVENT);
}
