import { sessionStateWord } from "@agari/core/copy";
import type { LeverageReserveState } from "@agari/core/leverage";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { useBalanceSheet, useLeverageReserve } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { SHORT } from "@/features/short/copy";
import { useShortWindows } from "@/features/short/useShortWindows";
import { useWalletSession } from "@/lib/wallet-session";
import { EmptyState, Pill, ReadingView, Screen, SectionHeader } from "~/components/kit";
import { HowCards, TitleHero } from "./PageParts";
import { ReviewSheet, type ReviewRequest } from "./ReviewSheet";
import { ShortPicker } from "./ShortPicker";
import { ShortPositions } from "./ShortPositions";
import { percentOf } from "./ShortSizer";
import { ShortTicket } from "./ShortTicket";

/** `/short` — web's `features/short/ShortScreen.tsx`: the inverse position over the leverage reserve (A-1b). */
export function ShortScreen() {
  const queryClient = useQueryClient();
  const reading = useLeverageReserve();
  const [review, setReview] = useState<ReviewRequest | null>(null);
  return (
    <Screen title={SHORT.title} onRefresh={() => queryClient.invalidateQueries()}>
      <ReadingView reading={reading} loading="plate">
        {(state) => (state ? <Page reserve={state} onReview={setReview} /> : <NotDeployed />)}
      </ReadingView>
      <ReviewSheet request={review} onClose={() => setReview(null)} />
    </Screen>
  );
}

function NotDeployed() {
  const { notDeployed } = SHORT;
  return <EmptyState why={`${notDeployed.title} · needs ${notDeployed.dependency}`} detail={`${notDeployed.body}\n\n${notDeployed.why}`} />;
}

function Page({ reserve, onReview }: { reserve: LeverageReserveState; onReview: (request: ReviewRequest) => void }) {
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const nowMs = useChainNowMs();
  const session = useMarketSession();
  const { stocks, loading } = useShortWindows(nowMs);
  const { address } = useWalletSession();
  const balance = useBalanceSheet(address);
  const [picked, setPicked] = useState<EventMarket | null>(null);
  const { sections } = SHORT;

  // web's rule: the pick follows the board — a Window that rolled away is replaced by that stock's next one.
  const live = stocks.flatMap((s) => s.windows);
  const selected =
    live.find((m) => m.marketId === picked?.marketId) ??
    (picked ? stocks.find((s) => s.asset === picked.asset)?.windows[0] : undefined) ??
    live[0] ??
    null;

  return (
    <>
      <TitleHero
        eyebrow={SHORT.eyebrow}
        aside={session ? <Pill label={`${sessionStateWord(session.status)} · ${session.label}`} tone={session.open ? "profit" : "neutral"} dot /> : null}
        title={SHORT.title}
        lead={SHORT.lede}
      />

      <SectionHeader index={sections.open.number} title={sections.open.title} desc={sections.open.desc} />
      <ShortPicker stocks={stocks} loading={loading} selected={selected} onSelect={setPicked} nowMs={nowMs} />
      <ShortTicket
        market={selected}
        nowMs={nowMs}
        reserve={reserve}
        symbol={symbol}
        walletBase={balance && isOk(balance) ? balance.value.spendableBase : null}
        onReview={onReview}
      />

      <SectionHeader index={sections.positions.number} title={sections.positions.title} desc={sections.positions.desc} />
      <ShortPositions symbol={symbol} decimals={reserve.decimals} nowMs={nowMs} onReview={onReview} />

      <SectionHeader index={sections.how.number} title={sections.how.title} />
      <HowCards cards={SHORT.how(percentOf(reserve.params.premiumBps), percentOf(reserve.params.maintenanceBps))} />
    </>
  );
}
