/**
 * Where agari-desk lives (desk.md §2, D-126): the program id, its PDAs, the mainnet constants the desk trades
 * against, and the eight PreStocks mints by symbol. The desk is a mainnet product read through an explicit RPC, never
 * through the app's devnet read runtime; nothing here touches `configureMarkets`.
 */
import { AGARI_DESK_PROGRAM_ADDRESS, findConfigPda, findDeskPda, findDeskRefPda } from "@agari/clients/agari-desk";
import { PRE_IPO_SYMBOLS, TICKERS, type PreIpoSymbol } from "@agari/core/market";
import type { Hash32 } from "@agari/core/types";
import { address, getProgramDerivedAddress, type Address } from "@solana/kit";
import { findAssociatedTokenPda } from "@solana-program/token";
import { peekClient } from "../runtime/read-runtime";

export const USDC_MAINNET = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const JUPITER_V6 = address("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
export const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const INSTRUCTIONS_SYSVAR = address("Sysvar1nstructions1111111111111111111111111");
/** Core `CLUSTER_ID["mainnet-beta"]`, the tag every mainnet reference message carries. */
export const MAINNET_CLUSTER_TAG = 101;

/** The eight PreStocks mints (Token-2022, 9 dp) by catalogue symbol, from the registry. */
export const DESK_MINTS: Readonly<Record<PreIpoSymbol, Address>> = Object.fromEntries(
  PRE_IPO_SYMBOLS.map((symbol) => [symbol, address(TICKERS[symbol].preIpo?.mint as string)]),
) as Record<PreIpoSymbol, Address>;

const SYMBOL_OF_MINT = new Map<string, PreIpoSymbol>(PRE_IPO_SYMBOLS.map((symbol) => [DESK_MINTS[symbol] as string, symbol]));

export const deskSymbolOfMint = (mint: string): PreIpoSymbol | null => SYMBOL_OF_MINT.get(mint) ?? null;

/**
 * Pyth `Equity.Index.<NAME>/USD` feed ids (Hermes, verified 2026-09-22; expo −5, 24/7): the optional independent
 * reference a desk may require (D-125). The venue is not entitled to them yet; the program is switch-ready.
 */
export const PYTH_INDEX_FEEDS: Readonly<Partial<Record<PreIpoSymbol, Hash32>>> = {
  OPENAI: "0x96d4bb23a3db78fdb72b3a03ce80ead686096f324319166534d9a27c0519c483",
  ANTHROPIC: "0x5da511a7c68b17a3bc94380cab4756bc83ab87f86307af10ea58467a64b6689d",
};

/**
 * The program the client is built against, or the configured override (`NEXT_PUBLIC_AGARI_DESK_PROGRAM_ID`). An
 * override that is not the generated client's program is a misconfiguration, never a second desk program.
 */
export function deskProgramId(override?: string | null): Address {
  const configured = override ?? peekClient()?.deskProgramId ?? null;
  if (configured && configured !== (AGARI_DESK_PROGRAM_ADDRESS as string)) {
    throw new Error(`NEXT_PUBLIC_AGARI_DESK_PROGRAM_ID ${configured} is not the agari-desk client's program ${AGARI_DESK_PROGRAM_ADDRESS}`);
  }
  return AGARI_DESK_PROGRAM_ADDRESS;
}

const pdas = new Map<string, Promise<Address>>();
function cached(key: string, derive: () => Promise<readonly [Address, number]>): Promise<Address> {
  let found = pdas.get(key);
  if (!found) {
    found = derive().then(([pda]) => pda);
    pdas.set(key, found);
  }
  return found;
}

export const deskConfigAddress = () => cached("config", () => findConfigPda());
export const deskAddress = (owner: Address) => cached(`desk:${owner}`, () => findDeskPda({ owner }));
export const deskRefAddress = (mint: Address) => cached(`ref:${mint}`, () => findDeskRefPda({ mint }));
/** The desk's own `#[event_cpi]` authority (`["__event_authority"]`). */
export const deskEventAuthority = () => cached("event-authority", () => getProgramDerivedAddress({ programAddress: AGARI_DESK_PROGRAM_ADDRESS, seeds: ["__event_authority"] }));

/** The associated token account of `owner` for `mint` under `tokenProgram` (USDC under Token, a name under Token-2022). */
export const associatedTokenAddress = (owner: Address, mint: Address, tokenProgram: Address) =>
  cached(`ata:${owner}:${mint}:${tokenProgram}`, () => findAssociatedTokenPda({ owner, mint, tokenProgram }));

export const tokenProgramOf = (mint: Address, usdcMint: Address = USDC_MAINNET): Address => (mint === usdcMint ? TOKEN_PROGRAM : TOKEN_2022_PROGRAM);

/** The desk's two accounts for a swap: its USDC and the name's, both owned by the desk PDA. */
export async function deskTokenAccounts(desk: Address, mint: Address, usdcMint: Address = USDC_MAINNET): Promise<{ deskUsdc: Address; deskToken: Address }> {
  const [deskUsdc, deskToken] = await Promise.all([associatedTokenAddress(desk, usdcMint, TOKEN_PROGRAM), associatedTokenAddress(desk, mint, TOKEN_2022_PROGRAM)]);
  return { deskUsdc, deskToken };
}
