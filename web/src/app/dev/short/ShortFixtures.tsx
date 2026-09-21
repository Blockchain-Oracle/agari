"use client";

import Link from "next/link";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { SHORT, ShortPositionCard } from "@/features/short";
import { CLOSED, FIXTURE_SYMBOL, KNOCKED, KNOCKED_OWED, LIVE, LIVE_3X, LOST, MARKET, SETTLING, WON } from "../leverage/fixtures";
import { FIXTURE_NOW_MS, MARK_AT, MARK_CLEAR, MARK_CLOSE, MARK_THIN } from "./fixtures";
import "@/features/short/short-page.css";

const noop = () => undefined;
const CARD = { market: MARKET, symbol: FIXTURE_SYMBOL, decimals: 6, nowMs: FIXTURE_NOW_MS, busy: null, canSign: true, onClose: noop, onSettle: noop, onClaim: noop } as const;

/** `/dev/short` — the managed-position card in every state it can reach, on canned readings. Never linked from the app. */
export function ShortFixtures() {
  return (
    <div className="container sh-page">
      <SectionHeader index="00" eyebrow="Fixtures" title={SHORT.title} />
      <p className="type-caption text-ink-muted">
        Canned readings only. The live surface is <Link href="/short">/short</Link>.
      </p>
      <FixtureGrid>
        <Fixture label="Live — room, close to the line, at the line, nothing to mark against">
          <ul className="sh-list">
            <ShortPositionCard {...CARD} position={LIVE} mark={MARK_CLEAR} />
            <ShortPositionCard {...CARD} position={LIVE} mark={MARK_CLOSE} />
            <ShortPositionCard {...CARD} position={LIVE_3X} mark={MARK_AT} />
            <ShortPositionCard {...CARD} position={LIVE} mark={MARK_THIN} />
          </ul>
        </Fixture>
        <Fixture label="Settling, and the four endings">
          <ul className="sh-list">
            <ShortPositionCard {...CARD} position={SETTLING} mark={MARK_CLEAR} />
            <ShortPositionCard {...CARD} position={WON} mark={null} />
            <ShortPositionCard {...CARD} position={LOST} mark={null} />
            <ShortPositionCard {...CARD} position={KNOCKED} mark={null} />
            <ShortPositionCard {...CARD} position={CLOSED} mark={null} />
          </ul>
        </Fixture>
        <Fixture label="Knocked out with the owner's money left waiting (D-114)">
          <ul className="sh-list">
            <ShortPositionCard {...CARD} position={KNOCKED_OWED} mark={null} />
          </ul>
        </Fixture>
      </FixtureGrid>
    </div>
  );
}
