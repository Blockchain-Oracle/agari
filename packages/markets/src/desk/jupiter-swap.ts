/**
 * Jupiter for the desk (desk.md §1, plan §8 C3): `/quote` at the candidate's exact size with `maxAccounts` small
 * enough for a CPI, then `/swap-instructions` with the desk PDA as the user and its own associated account as the
 * destination. The desk PDA cannot sign a setup instruction, wrap SOL or receive a cleanup, so any of those in the
 * answer refuses the route. Lite-api is keyless (0.5 RPS); `api.jup.ag` takes `JUPITER_API_KEY` (server-only).
 */
import { AccountRole, getBase64Encoder, type AccountMeta, type Address, type Instruction } from "@solana/kit";
import { z } from "zod";
import { JUPITER_V6 } from "./deployment";

export const JUPITER_LITE_SWAP_URL = "https://lite-api.jup.ag/swap/v1";
export const JUPITER_KEYED_SWAP_URL = "https://api.jup.ag/swap/v1";
/** The most accounts a route may carry inside the desk's transaction (the desk adds 15 of its own). */
export const DESK_MAX_ROUTE_ACCOUNTS = 20;
export const DEFAULT_SLIPPAGE_BPS = 50;
const TIMEOUT_MS = 8_000;

const decimal = z.string().regex(/^\d+$/);
const quoteSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: decimal,
  outAmount: decimal,
  otherAmountThreshold: decimal,
  swapMode: z.string(),
  slippageBps: z.number().int(),
  priceImpactPct: z.string().optional(),
  routePlan: z.array(z.object({ swapInfo: z.object({ label: z.string().optional(), ammKey: z.string().optional() }), percent: z.number().optional() })).default([]),
  contextSlot: z.number().int().optional(),
});
const wireInstruction = z.object({ programId: z.string(), accounts: z.array(z.object({ pubkey: z.string(), isSigner: z.boolean(), isWritable: z.boolean() })), data: z.string() });
const swapSchema = z.object({
  computeBudgetInstructions: z.array(wireInstruction).default([]),
  setupInstructions: z.array(wireInstruction).default([]),
  swapInstruction: wireInstruction,
  cleanupInstruction: wireInstruction.nullable().optional(),
  otherInstructions: z.array(wireInstruction).default([]),
  addressLookupTableAddresses: z.array(z.string()).default([]),
});

export interface JupiterQuote {
  inputMint: Address;
  outputMint: Address;
  inAmount: bigint;
  outAmount: bigint;
  /** `outAmount` less the quoted slippage: what Jupiter itself would enforce. */
  otherAmountThreshold: bigint;
  slippageBps: number;
  /** `priceImpactPct` floored to basis points; null when Jupiter omitted it. */
  priceImpactBps: number | null;
  routeLabels: string[];
  contextSlot: number | null;
  /** The answer as received, passed back to `/swap-instructions` untouched. */
  raw: unknown;
}

export interface QuoteInput {
  inputMint: Address;
  outputMint: Address;
  amount: bigint;
  slippageBps?: number;
  maxAccounts?: number;
  onlyDirectRoutes?: boolean;
  /** Restrict to these venues (Jupiter's labels) when a route overflows the CPI depth. */
  dexes?: readonly string[];
  apiKey?: string;
  signal?: AbortSignal;
}

export class JupiterError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "JupiterError";
  }
}

const baseUrl = (apiKey?: string) => (apiKey ? JUPITER_KEYED_SWAP_URL : JUPITER_LITE_SWAP_URL);
const headers = (apiKey?: string): Record<string, string> => (apiKey ? { "x-api-key": apiKey } : {});

/** `"0.00029"` → 2 bps (floored from the decimal text; no float). */
export function impactPctToBps(text: string | undefined): number | null {
  if (text === undefined) return null;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) return null;
  const whole = BigInt(m[1] as string);
  const fraction = (m[2] ?? "").slice(0, 6).padEnd(6, "0");
  return Number((whole * 1_000_000n + BigInt(fraction)) / 100n);
}

async function call(url: string, init: RequestInit, apiKey?: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { ...headers(apiKey), ...(init.headers as Record<string, string> | undefined) }, signal: signal ?? AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new JupiterError(`Jupiter ${error instanceof Error && error.name === "TimeoutError" ? "timed out" : "unreachable"}`);
  }
  if (!response.ok) throw new JupiterError(`Jupiter HTTP ${response.status}`, response.status);
  return response.json();
}

export async function quoteSwap(i: QuoteInput): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint: i.inputMint,
    outputMint: i.outputMint,
    amount: i.amount.toString(),
    slippageBps: String(i.slippageBps ?? DEFAULT_SLIPPAGE_BPS),
    swapMode: "ExactIn",
    maxAccounts: String(i.maxAccounts ?? DESK_MAX_ROUTE_ACCOUNTS),
    restrictIntermediateTokens: "true",
    onlyDirectRoutes: String(i.onlyDirectRoutes ?? false),
  });
  if (i.dexes && i.dexes.length > 0) params.set("dexes", i.dexes.join(","));
  const body = quoteSchema.parse(await call(`${baseUrl(i.apiKey)}/quote?${params}`, { method: "GET" }, i.apiKey, i.signal));
  return {
    inputMint: body.inputMint as Address,
    outputMint: body.outputMint as Address,
    inAmount: BigInt(body.inAmount),
    outAmount: BigInt(body.outAmount),
    otherAmountThreshold: BigInt(body.otherAmountThreshold),
    slippageBps: body.slippageBps,
    priceImpactBps: impactPctToBps(body.priceImpactPct),
    routeLabels: body.routePlan.map((r) => r.swapInfo.label ?? "?"),
    contextSlot: body.contextSlot ?? null,
    raw: body,
  };
}

export interface JupiterRoute {
  /** The router's instruction data, forwarded opaque to `operator_buy` / `operator_sell`. */
  swapData: Uint8Array;
  /** The router's accounts in order, with no signer flags: the program flags the desk PDA on the CPI. */
  route: AccountMeta[];
  accountCount: number;
  lookupTables: Address[];
  /** Jupiter's own compute-budget instructions, for reference; the desk sets its own limit from a simulation. */
  computeBudgetInstructions: Instruction[];
}

export interface SwapInstructionsInput {
  quote: JupiterQuote;
  /** The desk PDA: Jupiter's `userPublicKey`. */
  desk: Address;
  /** The desk's associated account of the output mint. */
  destinationTokenAccount: Address;
  apiKey?: string;
  signal?: AbortSignal;
}

function decodeInstruction(w: z.infer<typeof wireInstruction>): Instruction {
  return {
    programAddress: w.programId as Address,
    accounts: w.accounts.map((a) => ({ address: a.pubkey as Address, role: a.isWritable ? (a.isSigner ? AccountRole.WRITABLE_SIGNER : AccountRole.WRITABLE) : a.isSigner ? AccountRole.READONLY_SIGNER : AccountRole.READONLY })),
    data: new Uint8Array(getBase64Encoder().encode(w.data)),
  };
}

/** The route for `quote`, refused when Jupiter wants anything the desk PDA cannot do (setup, wrapping, cleanup). */
export async function swapInstructions(i: SwapInstructionsInput): Promise<JupiterRoute> {
  const request = {
    quoteResponse: i.quote.raw,
    userPublicKey: i.desk,
    destinationTokenAccount: i.destinationTokenAccount,
    wrapAndUnwrapSol: false,
    skipUserAccountsRpcCalls: true,
    useSharedAccounts: true,
    dynamicComputeUnitLimit: false,
  };
  const body = swapSchema.parse(await call(`${baseUrl(i.apiKey)}/swap-instructions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) }, i.apiKey, i.signal));
  if (body.setupInstructions.length > 0) throw new JupiterError(`the route needs ${body.setupInstructions.length} setup instruction(s) the desk cannot sign`);
  if (body.cleanupInstruction) throw new JupiterError("the route wants a cleanup instruction the desk cannot sign");
  if (body.otherInstructions.length > 0) throw new JupiterError(`the route carries ${body.otherInstructions.length} extra instruction(s)`);
  if (body.swapInstruction.programId !== (JUPITER_V6 as string)) throw new JupiterError(`the swap is not Jupiter v6 (${body.swapInstruction.programId})`);
  if (!body.swapInstruction.accounts.some((a) => a.pubkey === (i.desk as string) && a.isSigner)) throw new JupiterError("the swap does not name the desk as its signing authority");
  const swap = decodeInstruction(body.swapInstruction);
  const route: AccountMeta[] = (swap.accounts ?? []).map((a) => ({ address: a.address, role: a.role === AccountRole.WRITABLE_SIGNER ? AccountRole.WRITABLE : a.role === AccountRole.READONLY_SIGNER ? AccountRole.READONLY : a.role }));
  return {
    swapData: swap.data as Uint8Array,
    route,
    accountCount: route.length,
    lookupTables: body.addressLookupTableAddresses.map((a) => a as Address),
    computeBudgetInstructions: body.computeBudgetInstructions.map(decodeInstruction),
  };
}
