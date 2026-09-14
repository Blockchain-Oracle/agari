import type { MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { Badge } from "@/components/ui/badge";
import { HERO, formatCadence } from "@/lib/copy";
import { MarketSessionChip } from "../session";

interface HeroHeaderProps {
  market: EventMarket;
  phase: MarketPhase;
}

export function HeroHeader({ market, phase }: HeroHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 className="type-headline text-ink">{market.asset}</h3>
        <Badge variant="outline" className="numbers">
          {formatCadence(market.intervalSec)}
        </Badge>
        {phase !== "trading" && <span className="type-label-micro text-ink-secondary">{HERO.phase[phase]}</span>}
        <MarketSessionChip />
      </div>
      <p className="type-body text-ink-secondary">{HERO.question(market.asset)}</p>
    </header>
  );
}
