"use client";

import { toMarketId } from "@masayume/core/types";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { CallPlacedCard, renderCallShareCard, renderTradeShareCard, type CallCard, type TradeCard } from "@/features/share";
import { DECIMALS, FIXED_NOW_MS, FIXED_NOW_SEC, SYMBOL, TX_HASH } from "../states/fixtures";

const DEV = {
  title: "Share cards",
  intro: "The Call as it appears the instant a bet lands, then both PNG exports — the 1600×900 X banner with the QR stub — rendered from canned records. No wallet, no chain.",
  call: "The Call — on screen, 4:12 left of a 5m Window",
  pngCall: "The Call — the 1600×900 export",
  pngTrade: "Earned Heat — win, loss, void, close-out, and a payout with no cost on record",
  rendering: "rendering…",
} as const;

const MARKET = toMarketId(`0x${"5a1f0e2d".repeat(8)}`);

const CALL: CallCard = {
  asset: "BTC",
  side: "up",
  intervalSec: 300,
  lineRaw: 6431600n,
  stakeBase: 12_000_000n,
  contractsRaw: 18_750_000n,
  decimals: DECIMALS,
  symbol: SYMBOL,
  feeBps: 200,
  expirySec: FIXED_NOW_SEC + 252,
  txHash: TX_HASH,
  placedAtMs: FIXED_NOW_MS - 48_000,
  leverage: null,
};

/** The same call at 2×: 32 contracts on a 10 stake, the reserve's 10 repaid first, the reference's caveat printed. */
const BOOSTED_CALL: CallCard = { ...CALL, stakeBase: 10_000_000n, contractsRaw: 32_000_000n, leverage: { leverageBps: 20_000, frontedBase: 10_000_000n } };

const BASE: TradeCard = {
  asset: "BTC",
  intervalSec: 300,
  sides: ["up"],
  outcome: "win",
  lineRaw: 6431600n,
  closeRaw: 6438912n,
  stakeBase: 12_000_000n,
  payoutBase: 18_375_000n,
  pnlBase: 6_375_000n,
  decimals: DECIMALS,
  symbol: SYMBOL,
  expirySec: FIXED_NOW_SEC - 900,
  settledAtMs: FIXED_NOW_MS - 880_000,
  entryTxHash: TX_HASH,
  settlementTxHash: `0x${"1c0ffee5".repeat(8)}`,
};

const TRADES: TradeCard[] = [
  BASE,
  { ...BASE, sides: ["down"], outcome: "loss", payoutBase: 0n, pnlBase: -12_000_000n },
  { ...BASE, outcome: "void", closeRaw: null, payoutBase: 9_375_000n, pnlBase: -2_625_000n },
  { ...BASE, outcome: "closed", closeRaw: null, payoutBase: 0n, pnlBase: 1_120_000n, settlementTxHash: null },
  { ...BASE, stakeBase: null, pnlBase: 18_375_000n, entryTxHash: null },
];

function Png({ render }: { render: () => Promise<Blob> }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    void render().then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [render]);
  // A rendered export, shown at a quarter of its width.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="dev-share-png" /> : <p className="type-caption text-ink-muted">{DEV.rendering}</p>;
}

export default function DevSharePage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-10 px-gutter py-8">
      <div className="flex flex-col gap-2">
        <SectionHeader index="00" title={DEV.title} />
        <p className="type-body text-ink-secondary">{DEV.intro}</p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title={DEV.call} />
        <div className="mx-auto w-full max-w-(--content-reading)">
          <CallPlacedCard card={CALL} nowMs={FIXED_NOW_MS} />
        </div>
        <div className="mx-auto w-full max-w-(--content-reading)">
          <CallPlacedCard card={BOOSTED_CALL} nowMs={FIXED_NOW_MS} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title={DEV.pngCall} />
        <Png render={() => renderCallShareCard(CALL)} />
        <Png render={() => renderCallShareCard(BOOSTED_CALL)} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="03" title={DEV.pngTrade} />
        <div className="dev-share-grid">
          {TRADES.map((trade, i) => (
            <Png key={i} render={() => renderTradeShareCard(trade)} />
          ))}
        </div>
      </section>
    </div>
  );
}
