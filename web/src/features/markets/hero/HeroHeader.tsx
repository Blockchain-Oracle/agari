import type { MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { Badge } from "@/components/ui/badge";
import { HERO } from "@/lib/copy";
import { laneAssetLabel, laneCadenceLabel } from "../lanes/lane-view";
import { MarketSessionChip } from "../session";

interface HeroHeaderProps {
  market: EventMarket;
  phase: MarketPhase;
}

export function HeroHeader({ market, phase }: HeroHeaderProps) {
  const asset = laneAssetLabel(market.asset, market.lane);
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 className="type-headline text-ink">{asset}</h3>
        <Badge variant="outline" className="numbers">
          {laneCadenceLabel(market.lane, market.intervalSec)}
        </Badge>
        {phase !== "trading" && <span className="type-label-micro text-ink-secondary">{HERO.phase[phase]}</span>}
        <MarketSessionChip asset={asset} />
      </div>
      <p className="type-body text-ink-secondary">{HERO.question(asset)}</p>
    </header>
  );
}
