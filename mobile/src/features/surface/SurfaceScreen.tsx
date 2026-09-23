import { formatCadence } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import { keys } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { SURFACE } from "@/features/surface/copy";
import { useFocalBook } from "@/features/surface/useFocalBook";
import { useSurfaceSelection } from "@/features/surface/useSurfaceSelection";
import { useTermStructure } from "@/features/surface/useTermStructure";
import { EmptyState, ErrorState, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { BookTiles } from "./BookTiles";
import { DepthChart } from "./DepthChart";
import { SlippageLadder } from "./SlippageLadder";
import { SurfaceChips } from "./SurfaceChips";
import { TermChart } from "./TermChart";
import { TermHeat } from "./TermHeat";

/**
 * `/surface` — web's SurfaceScreen (features/surface/SurfaceScreen.tsx): the venue's live book read back for one Window
 * at a time — the book's readout, its depth, what each stake really buys, and the term structure across every live
 * Window of the asset (a curve, then a heat grid you tap to switch Windows). No figure the chain did not give.
 */
export function SurfaceScreen() {
  const { color } = useTheme();
  const client = useQueryClient();
  const { boot, venueId } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const nowMs = useChainNowMs();
  const selection = useSurfaceSelection(venueId);
  const focal = selection.focal;
  const { book, structure, params, fee, openingRaw, spotRaw } = useFocalBook(focal);
  const points = useTermStructure(selection.windows, nowMs);
  const session = useMarketSession();
  const emptyWhy = session && !session.open ? SURFACE.closed(session.label) : SURFACE.noLive;
  const { sections } = SURFACE;
  const lanes = boot && !boot.ok ? boot : selection.reading;
  const reread = () =>
    Promise.all([client.invalidateQueries({ queryKey: keys.boot() }), client.invalidateQueries({ queryKey: keys.lanes(venueId) })]);

  let body;
  if (!lanes) body = <LoadingState shape="plate" label={SURFACE.reading} />;
  else if (!lanes.ok) body = <ErrorState diagnosis={lanes.error} retry={() => void reread()} />;
  else if (lanes.value.lanes.length === 0 || !focal) body = <EmptyState why={emptyWhy} />;
  else {
    body = (
      <>
        <SurfaceChips
          assets={selection.assets}
          asset={selection.asset}
          onAsset={selection.setAsset}
          windows={selection.windows}
          focalId={focal.marketId}
          onFocal={selection.setFocal}
          nowMs={nowMs}
        />
        <SectionHeader index={sections.book.number} title={sections.book.title} aside={sections.meta.book(focal.asset, formatCadence(focal.intervalSec))} />
        <BookTiles market={focal} structure={structure} hydrating={book === null} openingRaw={openingRaw} spotRaw={spotRaw} nowMs={nowMs} />
        {book?.ok && book.stale ? <Text style={[TYPE.caption, { color: color.warning }]}>Showing the last good book; the latest read failed.</Text> : null}
        {book && !book.ok ? <ErrorState diagnosis={book.error} /> : null}

        <SectionHeader index={sections.depth.number} title={sections.depth.title} desc={sections.depth.desc} aside={structure ? sections.meta.levels(structure.levels) : undefined} />
        <DepthChart depth={book?.ok ? book.value : null} hydrating={book === null} />

        <SectionHeader index={sections.slippage.number} title={sections.slippage.title} desc={sections.slippage.desc} />
        <SlippageLadder
          depth={book?.ok ? book.value : null}
          hydrating={book === null}
          symbol={symbol}
          lotRaw={params?.ok ? params.value.lotSizeRaw : null}
          feeBps={fee?.ok ? fee.value : null}
        />

        <SectionHeader index={sections.term.number} title={sections.term.title} desc={sections.term.desc(focal.asset)} aside={sections.meta.windows(selection.windows.length)} />
        <TermChart points={points} focalId={focal.marketId} onPick={selection.setFocal} />
        <TermHeat points={points} decimals={focal.decimals} nowMs={nowMs} focalId={focal.marketId} onPick={selection.setFocal} />

        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{SURFACE.basis}</Text>
        {lanes.stale ? <Text style={[TYPE.caption, { color: color.warning }]}>Showing the last good lane read; the latest refresh failed.</Text> : null}
      </>
    );
  }

  return (
    <Screen title={SURFACE.title} onRefresh={reread}>
      <View style={styles.hero}>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>
          {SURFACE.crumbRoot} / {SURFACE.crumb}
        </Text>
        <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
          {SURFACE.title}
        </Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>
          {SURFACE.intro.lead}
          <Text style={{ color: color.accent }}>{SURFACE.intro.em}</Text>
          {SURFACE.intro.rest}
        </Text>
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
});
