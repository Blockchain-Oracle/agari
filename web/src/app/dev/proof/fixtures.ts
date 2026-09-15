import type { PrintProof, PythReplay } from "@agari/markets";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";

/**
 * `/dev/proof`: one Window's four prints in every replay state. Shaped on the TSLA 5m Window that closed 2026-09-14
 * 16:00 ET (Pyth primary, RedStone check); ids, signatures and addresses are fixture values, not real accounts.
 */
const MARKET = fixtureMarketId(`0x${"7e57".repeat(16)}`);
const T_OPEN = 1_789_415_700;
const T_CLOSE = 1_789_416_000;
const sig = (n: number) => fixtureSignature(`0x${n.toString(16).padStart(2, "0").repeat(64)}`);

const VERIFIED: PythReplay = {
  state: "verified",
  receiver: "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
  priceUpdate: fixtureAddress(`0x${"9d".repeat(32)}`),
  verification: "full",
  price: 35_898_253n,
  conf: 8_253n,
  expo: -5,
  publishTimeSec: T_CLOSE,
  prevPublishTimeSec: T_CLOSE - 1,
  postedSlot: 498_628_202n,
  postSignatures: [sig(0x21), sig(0x22), sig(0x23), sig(0x24)],
  closeSignatures: [],
  payer: fixtureAddress(`0x${"4a".repeat(32)}`),
  error: null,
  postedAtMs: Date.UTC(2026, 8, 15, 6, 5, 0),
  closedAtMs: null,
};

const archive = (feed: string, boundarySec: number, bytes: number, signers: number, addresses: string[] | null): PrintProof["archive"] => ({
  feed,
  signers,
  fetchedAtMs: boundarySec * 1000 + 4_210,
  archivedAtMs: boundarySec * 1000 + 4_388,
  payloadBytes: bytes,
  payloadSha256: "3f9c2a0b7d41e8c65b0f1d2e3a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d",
  signerAddresses: addresses,
  packageTsMs: addresses ? boundarySec * 1000 : null,
});

const PYTH_FEED = "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1";
const SIGNERS = ["0x8BB8F32Df04c8b654987DAaeD53D6B6091e3B774", "0xdEB22f54738d54976C4c0fe5ce6d408E40d88499", "0x51Ce04Be4b3E32572C4Ec9135221d0691Ba7d202", "0xDD682daEC5A90dD295d14DA4b0bec9281017b5bE", "0x9c5AE89C4Af6aA32cE58588DBaF90d18a855B6de"];

const print = (which: PrintProof["which"], source: PrintProof["source"], priceE8: bigint, boundarySec: number, signers: number, n: number): PrintProof => ({
  market: MARKET,
  which,
  source,
  priceE8,
  boundarySec,
  signers,
  copied: false,
  recordedSec: boundarySec + 18,
  recordSignature: sig(n),
  symbol: "TSLA",
  archive: source === "pyth" ? archive(PYTH_FEED, boundarySec, 3_410, 1, null) : source === "redstone" ? archive("TSLA", boundarySec, 2_634, 5, SIGNERS) : null,
  replay: null,
});

export const FIXTURE_MARKET = MARKET;

/** Open (Pyth, closed after 24 h), close (Pyth, verified), and both RedStone check prints. */
export const WINDOW_PRINTS: PrintProof[] = [
  { ...print(0, "pyth", 35_942_501_000n, T_OPEN, 0, 0x31), replay: { ...VERIFIED, price: 35_942_501n, conf: 1_749n, publishTimeSec: T_OPEN, prevPublishTimeSec: T_OPEN - 1, state: "closed", closeSignatures: [sig(0x41)], closedAtMs: Date.UTC(2026, 8, 16, 6, 10, 0) } },
  { ...print(1, "pyth", 35_898_253_000n, T_CLOSE, 0, 0x32), replay: VERIFIED },
  print(2, "redstone", 35_949_909_426n, T_OPEN, 5, 0x33),
  print(3, "redstone", 35_907_116_349n, T_CLOSE, 5, 0x34),
];

/** The Pyth close in the states a reader can meet before it is proven, plus an attested demo print. */
export const STATE_PRINTS: PrintProof[] = [
  { ...print(1, "pyth", 35_898_253_000n, T_CLOSE, 0, 0x35), replay: null },
  { ...print(1, "pyth", 35_898_253_000n, T_CLOSE, 0, 0x36), replay: { ...VERIFIED, state: "posting", priceUpdate: null, price: null, conf: null, expo: null, publishTimeSec: null, postedSlot: null, postSignatures: [] } },
  { ...print(1, "pyth", 35_898_253_000n, T_CLOSE, 0, 0x37), replay: { ...VERIFIED, price: 35_898_254n } },
  { ...print(1, "attested", 35_907_116_349n, T_CLOSE, 1, 0x38), symbol: null },
];
