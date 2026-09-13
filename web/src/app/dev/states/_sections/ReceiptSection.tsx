import { SectionHeader } from "@/components/chrome";
import { Money } from "@/components/data";
import { Receipt, ReceiptRow } from "@/components/receipt";
import { verdictStrings } from "@/lib/copy";
import { DECIMALS, FIXED_NOW_MS, ORACLE_URL, SYMBOL, TX_HASH, TX_URL } from "../fixtures";
import { Fixture } from "./Fixture";

const SHORT_TX = `${TX_HASH.slice(0, 10)}…${TX_HASH.slice(-4)}`;

function StampPreview() {
  const win = verdictStrings("win");
  return (
    <span className="flex flex-col items-end">
      <span lang="ja" className="type-stamp text-accent">
        {win.kanji}
      </span>
      <span className="type-label-micro normal-case text-cream-ink/70">{win.line}</span>
    </span>
  );
}

export function ReceiptSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="05" title="Receipt" eyebrow="the one physical object" />
      <Fixture label="Claim receipt — cream, vermilion strip, dotted leaders, perforated stub, the single shadow">
        <div className="flex justify-center py-4">
          <Receipt
            figure={<Money value={12_400_000n} decimals={DECIMALS} symbol={SYMBOL} tone="pnl" className="text-cream-ink" />}
            figureLabel="Paid out"
            settledAtMs={FIXED_NOW_MS}
            stamp={<StampPreview />}
          >
            <ReceiptRow label="Window">BTC · 5m · UP</ReceiptRow>
            <ReceiptRow label="Stake">10.00 {SYMBOL}</ReceiptRow>
            <ReceiptRow label="Entry fill" href={TX_URL}>
              {SHORT_TX}
            </ReceiptRow>
            <ReceiptRow label="Settlement" href={TX_URL}>
              {SHORT_TX}
            </ReceiptRow>
            <ReceiptRow label="Oracle graph" href={ORACLE_URL}>
              question 1842
            </ReceiptRow>
            <ReceiptRow label="Oracle graph (degraded)" href={null}>
              question 1842
            </ReceiptRow>
          </Receipt>
        </div>
      </Fixture>
    </section>
  );
}
