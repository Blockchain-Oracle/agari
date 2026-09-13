import type { DiagnosisKind } from "../types/diagnosis";
import { OUT_OF_GAS } from "./strings";

export interface DiagnosisCopy {
  headline: string;
  body: string;
}

const COPY: Record<DiagnosisKind, DiagnosisCopy> = {
  "signer-required": { headline: "Connect a wallet first", body: "Reading works without one; writing needs your signature." },
  "wrong-chain": { headline: "Wrong network", body: "This app runs on Somnia Shannon. Switch and try again." },
  "user-rejected": { headline: "You cancelled in your wallet", body: "Nothing was sent. Try again when you're ready." },
  "out-of-gas": { headline: "Out of STT gas", body: OUT_OF_GAS },
  "insufficient-collateral": { headline: "Not enough tUSDC", body: "Your stake exceeds what your wallet holds. Mint from the faucet or lower the stake." },
  "insufficient-allowance": { headline: "Approval needed", body: "The venue needs permission to take your stake. It's absorbed into your next bet." },
  "market-not-trading": { headline: "The Window closed under you", body: "Your stake was never taken. The next Window is pre-armed." },
  "order-expired": { headline: "Order expired before it filled", body: "The book moved past your quote. Nothing was taken." },
  "post-only-would-cross": { headline: "Your price would fill immediately", body: "A backing order rests, it doesn't take. Adjust the level." },
  "no-liquidity": { headline: "No liquidity at this size", body: "Nobody is on the other side of this book right now. The next Window may have one." },
  "thin-book": { headline: "The book is too thin for this size", body: "Fewer contracts are resting than this order needs, or the spread is too wide to price. Nothing was taken." },
  "reserve-cap": { headline: "Above the reserve's cap for this Window", body: "The reserve limits what it fronts per position and per Window. A smaller stake fits; the cap is not a shortage." },
  "below-min-quantity": { headline: "Below the venue's minimum", body: "This size rounds to nothing on the venue's lot grid." },
  "outside-band": { headline: "Too close to certain or impossible", body: "This book is quoting outside the 2–97¢ band, so the order is refused rather than filled at a lottery price." },
  "daily-stop": { headline: "Daily Stop hit", body: "Betting reopens at midnight your time. Nothing was sent." },
  "invalid-price": { headline: "Off the price grid", body: "The venue rejected the price step. Requote and try again." },
  requote: { headline: "The book moved", body: "The odds changed before your ticket landed. Nothing was taken — check the new price and confirm again." },
  "not-settled": { headline: "Not settled yet", body: "The oracle hasn't printed. Redemption opens the moment it does." },
  "already-claimed": { headline: "Already paid out", body: "The auto-payout got here first. Your wallet already has it." },
  "faucet-refused": { headline: "Faucet refused", body: "The venue's faucet said no — you may hold enough already, or it's capped. Try later." },
  "indexer-down": { headline: "The indexer isn't answering", body: "Numbers stay at their last-good values until it's back." },
  "rpc-down": { headline: "The chain endpoint isn't answering", body: "We're rotating to the backup RPC. Last-good values stay on screen." },
  "contract-revert": { headline: "The contract refused", body: "Nothing moved. The technical details name the reason." },
  "grant-refused": { headline: "Outside the grant", body: "This order sits outside what the grant allows — its caps, expiry or actor. Adjust the grant or the size." },
  "not-deployed": { headline: "Not on this network yet", body: "The Trading Balance contract is not deployed here. Wallet orders still work." },
  "send-unknown": { headline: "Waiting for the chain to answer", body: "Your order is either in or it never left; we'll show you which." },
  unknown: { headline: "Something went sideways", body: "Nothing on-chain changed without a signature. Details below." },
};

export function diagnosisCopy(kind: DiagnosisKind): DiagnosisCopy {
  return COPY[kind];
}
