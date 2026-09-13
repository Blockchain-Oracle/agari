"use client";

import { toMarketId } from "@masayume/core/types";
import { SectionHeader } from "@/components/chrome";
import { TakeReelCard, type FeedTake } from "@/features/takes";
import { FIXED_NOW_MS, FIXED_NOW_SEC, WALLET } from "../states/fixtures";

const DEV = {
  title: "Takes",
  intro: "The take card in every state from canned rows — backed and open, up and down, with and without a note, on a live Window and a closed one. No wallet, no store.",
} as const;

const MARKET = toMarketId(`0x${"5a1f0e2d".repeat(8)}`);
const CLOSED = toMarketId(`0x${"9b8a7c6d".repeat(8)}`);

const SAMPLES: FeedTake[] = [
  { id: "1", marketId: MARKET, author: WALLET as FeedTake["author"], side: "down", caption: "cpi cools, momentum rolling down into the bell — under is free money", asset: "BTC", intervalSec: 300, expirySec: FIXED_NOW_SEC + 210, lineRaw: "6431600", backed: true, createdAtMs: FIXED_NOW_MS - 90_000 },
  { id: "2", marketId: MARKET, author: "0xa1b2c3d4e5f60718293a4b5c6d7e8f9012345678", side: "up", caption: "funding flipped positive, spot bid all session. up.", asset: "BTC", intervalSec: 3600, expirySec: FIXED_NOW_SEC + 2_400, lineRaw: "6418000", backed: false, createdAtMs: FIXED_NOW_MS - 720_000 },
  { id: "3", marketId: MARKET, author: "0xf00dcafe1234567890abcdef1234567890abcdef", side: "up", caption: "", asset: "ETH", intervalSec: 900, expirySec: FIXED_NOW_SEC + 500, lineRaw: null, backed: true, createdAtMs: FIXED_NOW_MS - 30_000 },
  { id: "4", marketId: CLOSED, author: "0x0099f97251af2d072fc492316ae30de3ab5639be", side: "down", caption: "chop city. it pins under the line till the bell.", asset: "BTC", intervalSec: 300, expirySec: FIXED_NOW_SEC - 3_600, lineRaw: "6400000", backed: true, createdAtMs: FIXED_NOW_MS - 3_900_000 },
];

export default function DevTakesPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="00" title={DEV.title} />
      <p className="type-body text-ink-secondary">{DEV.intro}</p>
      <div className="dev-take-column">
        {SAMPLES.map((take) => (
          <div key={take.id} className="dev-take-slot">
            <TakeReelCard take={take} nowMs={FIXED_NOW_MS} />
          </div>
        ))}
      </div>
    </div>
  );
}
