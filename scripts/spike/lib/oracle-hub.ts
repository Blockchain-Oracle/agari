import { PINNED_TESTNET } from "@masayume/markets";
import { encodeAbiParameters, type Address, type Hex } from "viem";

/**
 * The OracleHub as a price basis (context/43). The ABI slice, the module/market reads a reserve would
 * make, and the venue's own closing-question template rebuilt from a live `scheduleQuestion` call.
 */
export const ORACLE_HUB = PINNED_TESTNET.addresses.oracleHub as Address;
export const BINARY_MODULE = PINNED_TESTNET.addresses.binaryModule as Address;
/** The hub's revert while a question is still pending — one fixed selector, unnamed in the SDK. */
export const PENDING_SELECTOR = "0x25cd016c";
/** The closing print is quoted in cents. */
export const PRINT_DECIMALS = 2;

const questionDefinition = {
  type: "tuple",
  name: "def",
  components: [
    { type: "string", name: "questionText" },
    { type: "tuple[]", name: "sources", components: [{ type: "uint8", name: "sourceType" }, { type: "bytes", name: "params" }] },
    {
      type: "tuple",
      name: "validAnswers",
      components: [
        { type: "uint8", name: "answerType" },
        { type: "string[]", name: "discreteOutcomes" },
        { type: "tuple[]", name: "numericIntervals", components: [{ type: "int256", name: "low" }, { type: "int256", name: "high" }] },
        { type: "uint64", name: "numericDecimals" },
      ],
    },
    { type: "uint256", name: "resolutionTime" },
    { type: "uint256", name: "minAgreement" },
    { type: "uint256", name: "subcommitteeSize" },
    { type: "uint256", name: "subcommitteeThreshold" },
  ],
} as const;

export const oracleHubAbi = [
  { type: "function", name: "pullNumericAnswer", stateMutability: "view", inputs: [{ type: "uint256", name: "oracleQuestionId" }], outputs: [{ type: "int256", name: "numericValue" }, { type: "bool", name: "voided" }] },
  { type: "function", name: "pullAnswer", stateMutability: "view", inputs: [{ type: "uint256", name: "oracleQuestionId" }], outputs: [{ type: "uint8", name: "outcomeIdx" }, { type: "bool", name: "voided" }] },
  { type: "function", name: "getSchedulingCost", stateMutability: "view", inputs: [questionDefinition], outputs: [{ type: "uint256", name: "cost" }] },
  { type: "function", name: "questionKeyOf", stateMutability: "pure", inputs: [questionDefinition], outputs: [{ type: "bytes32", name: "key" }] },
  { type: "function", name: "questionIdByKey", stateMutability: "view", inputs: [{ type: "bytes32", name: "questionKey" }], outputs: [{ type: "uint256", name: "oracleQuestionId" }] },
  { type: "function", name: "bindCount", stateMutability: "view", inputs: [{ type: "uint256", name: "oracleQuestionId" }], outputs: [{ type: "uint32", name: "count" }] },
  { type: "function", name: "MAX_BINDS_PER_QUESTION", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { type: "function", name: "resolveReserve", stateMutability: "view", inputs: [], outputs: [{ type: "uint256", name: "reserve" }] },
] as const;

/** `markets(bytes32)` in the module's own tuple order (IDreamDex.sol mirrors it). */
export const binaryModuleAbi = [
  {
    type: "function",
    name: "markets",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "marketId" }],
    outputs: [
      { type: "uint256", name: "oracleQuestionId" },
      { type: "uint8", name: "outcomeSlotCount" },
      { type: "uint8", name: "voidPolicy" },
      { type: "address", name: "collateral" },
      { type: "uint32", name: "originOperatorId" },
      { type: "bytes32", name: "originVenueId" },
      { type: "address", name: "oracleAdapter" },
      { type: "address", name: "creator" },
      { type: "address", name: "market" },
      { type: "address", name: "pool" },
      { type: "uint256", name: "yesId" },
      { type: "uint256", name: "noId" },
      { type: "uint64", name: "tradingStart" },
      { type: "uint64", name: "expiry" },
    ],
  },
] as const;

export const binaryMarketAbi = [
  { type: "function", name: "status", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "isResolved", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "isVoided", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

export interface QuestionDefinition {
  questionText: string;
  sources: { sourceType: number; params: Hex }[];
  validAnswers: { answerType: number; discreteOutcomes: string[]; numericIntervals: { low: bigint; high: bigint }[]; numericDecimals: bigint };
  resolutionTime: bigint;
  minAgreement: bigint;
  subcommitteeSize: bigint;
  subcommitteeThreshold: bigint;
}

const INT256_MAX = (1n << 255n) - 1n;

function jsonSource(url: string, path: string) {
  return { sourceType: 1, params: encodeAbiParameters([{ type: "string" }, { type: "string" }, { type: "uint256" }], [url, path, BigInt(PRINT_DECIMALS)]) };
}

/**
 * The closing question a Window schedules: six exchange candles for the minute ending at its expiry,
 * one all-covering numeric interval, two decimals. Byte-exact against Shannon — `questionKeyOf` of this
 * definition is the key the hub recorded for the Window's question (contracts/test/WindowQuestion.sol
 * is the same template in Solidity).
 */
export function windowQuestion(asset: string, expirySec: number): QuestionDefinition {
  const t = expirySec;
  const ms0 = `${(t - 60) * 1000}`;
  const msLast = `${t * 1000 - 1}`;
  const msBefore = `${(t - 60) * 1000 - 1}`;
  const msT = `${t * 1000}`;
  return {
    questionText: `What is the price of ${asset} in USDC at unix time ${t} UTC?`,
    sources: [
      jsonSource(`https://data-api.binance.vision/api/v3/klines?symbol=${asset}USDC&interval=1m&startTime=${ms0}&endTime=${msLast}&limit=1`, "[0][4]"),
      jsonSource(`https://www.okx.com/api/v5/market/history-candles?instId=${asset}-USDC&bar=1m&before=${msBefore}&after=${msT}&limit=1`, "data[0][4]"),
      jsonSource(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${asset}USDC&interval=1&start=${ms0}&end=${msLast}&limit=1`, "result.list[0][4]"),
      jsonSource(`https://api.kucoin.com/api/v1/market/candles?type=1min&symbol=${asset}-USDC&startAt=${t - 60}&endAt=${t}`, "data[0][2]"),
      jsonSource(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${asset}_USDC&interval=1m&from=${t - 60}&to=${t - 1}`, "[0][2]"),
      jsonSource(`https://api.mexc.com/api/v3/klines?symbol=${asset}USDC&interval=1m&startTime=${ms0}&endTime=${msLast}&limit=1`, "[0][4]"),
    ],
    validAnswers: { answerType: 0, discreteOutcomes: [], numericIntervals: [{ low: 0n, high: INT256_MAX }], numericDecimals: BigInt(PRINT_DECIMALS) },
    resolutionTime: BigInt(t),
    minAgreement: 4n,
    subcommitteeSize: 3n,
    subcommitteeThreshold: 2n,
  };
}

export function questionLink(id: bigint | string): string {
  return `https://prd.oracle.somnia.host/questions/${id}?view=graph`;
}

export function printToUsd(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

/** The revert data a viem call surfaced, or null when the error carried none. */
export function revertDataOf(error: unknown): string | null {
  let cursor: unknown = error;
  for (let depth = 0; cursor && depth < 8; depth++) {
    const data = (cursor as { data?: unknown }).data;
    if (typeof data === "string" && data.startsWith("0x")) return data;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  const match = /0x[0-9a-f]{8}/i.exec(error instanceof Error ? error.message : String(error));
  return match ? match[0] : null;
}
