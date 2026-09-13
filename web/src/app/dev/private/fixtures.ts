import type { PrivateBudget, PrivateClaim, PrivateDeskState, PrivateQuote, PrivateTicket } from "@masayume/core/private";
import { toMarketId, type Address, type Hex } from "@masayume/core/types";
import { claimDomain, deriveSlotKeys, signPrivateClaim } from "@masayume/markets/private";
import { createWalletClient, http, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Canned readings; nothing here is a real position, address or deployment — except the signatures, which are
// really computed on mount with a throwaway key so the "Verified" state is genuinely checked, not faked.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
export const OWNER = "0x000000000000000000000000000000000000d357" as Address;
export const CONTRACT = "0x00000000000000000000000000000000000000d5" as Address;
export const CHAIN_ID = 50312;
/** A throwaway key that exists only on this page; its address plays the desk the contract pins. */
export const FIXTURE_DESK_KEY = `0x${"7a".repeat(32)}` as Hex;
export const FIXTURE_DESK = privateKeyToAccount(FIXTURE_DESK_KEY).address as Address;
const MARKET = toMarketId(`0x${(0x11393).toString(16).padStart(64, "0")}`);

export const DESK: PrivateDeskState = {
  deployment: { chainId: CHAIN_ID, privateDesk: CONTRACT, fromBlock: 478_100_000n },
  params: { minStakeBase: UNIT, maxStakeBase: 25n * UNIT, minTimeLeftSec: 60 },
  desk: FIXTURE_DESK,
  paused: false,
  poolBase: 0n,
  owedBase: 40n * UNIT,
  inSlotsBase: 10n * UNIT,
  decimals: DECIMALS,
};

export const BUDGET_FUNDED: PrivateBudget = { balanceBase: 40n * UNIT, allowanceBase: 25n * UNIT, spendableBase: 25n * UNIT };
export const BUDGET_EMPTY: PrivateBudget = { balanceBase: 0n, allowanceBase: 0n, spendableBase: 0n };
export const BUDGET_SHORT: PrivateBudget = { balanceBase: 4n * UNIT, allowanceBase: 4n * UNIT, spendableBase: 4n * UNIT };

/** 10 on UP off a 0.52 ask: the fork run's own figures (Window 71691). */
export const QUOTE: PrivateQuote = { side: "up", stakeBase: 10n * UNIT, quantityRaw: 19_230_000n, costBase: 9_999_600n, limitYesRaw: 520_000n, priceRaw: 520_000n, decimals: DECIMALS, quotedAtMs: FIXTURE_NOW_MS };

function claim(seed: string, outcomeIdx: 0 | 1, stakeBase: bigint, issuedAtMs: number): PrivateClaim {
  const keys = deriveSlotKeys(stringToHex(seed));
  return { owner: OWNER, slotId: keys.slotId, creditKey: keys.creditKey, marketId: MARKET, outcomeIdx, stakeBase: stakeBase.toString(), issuedAtMs };
}

/** Three claims signed for real by the throwaway desk; the second is then corrupted to exercise the failure state. */
export async function signedTickets(): Promise<PrivateTicket[]> {
  const wallet = createWalletClient({ account: privateKeyToAccount(FIXTURE_DESK_KEY), chain: { id: CHAIN_ID, name: "fixture", nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:1"] } } }, transport: http("http://127.0.0.1:1") });
  const domain = claimDomain(CHAIN_ID, CONTRACT);
  const base = { desk: FIXTURE_DESK, contract: CONTRACT, chainId: CHAIN_ID, asset: "BTC", intervalSec: 300, expirySec: Math.floor(FIXTURE_NOW_MS / 1000) + 180 };
  const zero = `0x${"00".repeat(32)}` as Hex;
  const open = claim("open", 0, 10n * UNIT, FIXTURE_NOW_MS - 60_000);
  const bad = claim("bad", 1, 5n * UNIT, FIXTURE_NOW_MS - 900_000);
  const won = claim("won", 0, 10n * UNIT, FIXTURE_NOW_MS - 7_200_000);
  const lost = claim("lost", 1, 3n * UNIT, FIXTURE_NOW_MS - 10_800_000);
  const [sOpen, sBad, sWon, sLost] = await Promise.all([open, bad, won, lost].map((c) => signPrivateClaim(wallet, domain, c)));
  return [
    { claim: open, signature: sOpen as Hex, ...base, quantityRaw: "19230000", costBase: "9999600", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: open.issuedAtMs, status: "open" },
    { claim: bad, signature: `0x11${(sBad as string).slice(4)}` as Hex, ...base, quantityRaw: "10400000", costBase: "4992000", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: bad.issuedAtMs, status: "open" },
    { claim: won, signature: sWon as Hex, ...base, expirySec: base.expirySec - 7_500, quantityRaw: "19230000", costBase: "9999600", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: won.issuedAtMs, status: "credited", payoutBase: "19230000", creditedAtMs: FIXTURE_NOW_MS - 6_000_000 },
    { claim: lost, signature: sLost as Hex, ...base, expirySec: base.expirySec - 11_000, quantityRaw: "6250000", costBase: "3000000", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: lost.issuedAtMs, status: "credited", payoutBase: "0", creditedAtMs: FIXTURE_NOW_MS - 9_000_000 },
  ];
}
