"use client";

import { SectionHeader, Ticker, WrongNetworkBanner } from "@/components/chrome";
import { notify } from "@/lib/toast";
import { SYMBOL, TICKER_ENTRIES } from "../fixtures";
import { Fixture } from "./Fixture";

export function ChromeSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="04" title="Chrome" eyebrow="ticker · banner · pill · section rhythm" />
      <Fixture label="Ticker — direction ticks in profit/loss ink; NVDA is frozen with a stale tick">
        <Ticker entries={TICKER_ENTRIES} className="rounded-md border" />
      </Fixture>
      <Fixture label="Wrong-network banner — names the fix, carries the switch">
        <WrongNetworkBanner chainName="Solana devnet" onSwitch={() => notify.neutral("Switch requested")} />
        <WrongNetworkBanner chainName="Solana devnet" onSwitch={() => undefined} switching />
      </Fixture>
      <Fixture label="Section header — index · title · eyebrow">
        <SectionHeader index="02" title="The window" eyebrow="live now" />
      </Fixture>
    </section>
  );
}
