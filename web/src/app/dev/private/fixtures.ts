import { CLUSTER_ID } from "@agari/core/constants";
import type { PrivateBudget, PrivateClaim, PrivateDeskState, PrivateQuote, PrivateTicket } from "@agari/core/private";
import type { Hash32, Hex } from "@agari/core/types";
import { fixtureAddress, fixtureMarketId } from "../fixture-ids";

// Canned readings; nothing here is a real position, address, deployment or signature. Masayume signed these claims for
// real with a throwaway EIP-712 key so "Verified" was genuinely checked. On Solana the desk signs an ed25519 claim over
// a canonical encoding (PD-4), which S10 defines; until then the tickets carry placeholder signatures and the page shows
// whatever the S1 verifier says about them, never a faked "Verified".
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
export const OWNER = fixtureAddress("0x000000000000000000000000000000000000d357");
export const CONTRACT = fixtureAddress("0x00000000000000000000000000000000000000d5");
export const CHAIN_ID = CLUSTER_ID.devnet;
/** The desk key the program pins; a fixture account. */
export const FIXTURE_DESK = fixtureAddress("0x7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a");
const MARKET = fixtureMarketId(0x11393);

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

/** A distinct 32-byte key per seed and role: the seed's UTF-8 bytes, a role byte, zero-padded. */
function fixtureKey(seed: string, role: number): Hash32 {
  const hex = [...new TextEncoder().encode(seed)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${`${hex}${role.toString(16).padStart(2, "0")}`.padEnd(64, "0")}`;
}

function claim(seed: string, outcomeIdx: 0 | 1, stakeBase: bigint, issuedAtMs: number): PrivateClaim {
  return { owner: OWNER, slotId: fixtureKey(seed, 1), creditKey: fixtureKey(seed, 2), marketId: MARKET, outcomeIdx, stakeBase: stakeBase.toString(), issuedAtMs };
}

/** A placeholder 65-byte signature, distinct per ticket. */
const placeholder = (n: number): Hex => `0x${n.toString(16).padStart(2, "0").repeat(65)}`;

/** Four tickets across the states; the second is the one Masayume corrupted to exercise the failure state. */
export async function signedTickets(): Promise<PrivateTicket[]> {
  const base = { desk: FIXTURE_DESK, contract: CONTRACT, chainId: CHAIN_ID, asset: "TSLA", intervalSec: 300, expirySec: Math.floor(FIXTURE_NOW_MS / 1000) + 180 };
  const zero = `0x${"00".repeat(32)}` as Hex;
  const open = claim("open", 0, 10n * UNIT, FIXTURE_NOW_MS - 60_000);
  const bad = claim("bad", 1, 5n * UNIT, FIXTURE_NOW_MS - 900_000);
  const won = claim("won", 0, 10n * UNIT, FIXTURE_NOW_MS - 7_200_000);
  const lost = claim("lost", 1, 3n * UNIT, FIXTURE_NOW_MS - 10_800_000);
  return [
    { claim: open, signature: placeholder(1), ...base, quantityRaw: "19230000", costBase: "9999600", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: open.issuedAtMs, status: "open" },
    { claim: bad, signature: placeholder(2), ...base, quantityRaw: "10400000", costBase: "4992000", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: bad.issuedAtMs, status: "open" },
    { claim: won, signature: placeholder(3), ...base, expirySec: base.expirySec - 7_500, quantityRaw: "19230000", costBase: "9999600", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: won.issuedAtMs, status: "credited", payoutBase: "19230000", creditedAtMs: FIXTURE_NOW_MS - 6_000_000 },
    { claim: lost, signature: placeholder(4), ...base, expirySec: base.expirySec - 11_000, quantityRaw: "6250000", costBase: "3000000", txs: { charge: zero, fund: zero, mint: zero }, openedAtMs: lost.issuedAtMs, status: "credited", payoutBase: "0", creditedAtMs: FIXTURE_NOW_MS - 9_000_000 },
  ];
}
