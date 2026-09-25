import { isOk } from "@agari/core/schemas";
import { keys } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { SURFACE } from "@/features/surface/copy";
import { useFocalBook } from "@/features/surface/useFocalBook";
import { useSurfaceSelection } from "@/features/surface/useSurfaceSelection";
import { useTermStructure } from "@/features/surface/useTermStructure";
import { EmptyState, ErrorState, LoadingState } from "~/components/kit";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { surfaceTokens } from "~/theme/web/explore/surface";
import { BookReadout } from "./BookReadout";
import { DepthChart } from "./DepthChart";
import { MONO, StaleTick } from "./parts";
import { SectionHead } from "./SectionHead";
import { SlippageLadder } from "./SlippageLadder";
import { SurfaceChips } from "./SurfaceChips";
import { TermStructure } from "./TermStructure";

/**
 * `/surface` — web's SurfaceScreen.tsx on a phone: the crumb, the 36 px title, the intro with its white phrase, the asset
 * and Window chips, then four numbered sections — the book, depth, slippage and the term structure — and the settlement
 * basis. No figure the chain did not give: hydrating is "…", an empty side is "—" or its own sentence.
 */
export function SurfaceScreen() {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const client = useQueryClient();
  const { boot, venueId } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const nowMs = useChainNowMs();
  const selection = useSurfaceSelection(venueId);
  const focal = selection.focal;
  const { book, structure, params, fee, openingRaw, spotRaw } = useFocalBook(focal);
  const points = useTermStructure(selection.windows, nowMs);
  const session = useMarketSession();
  const empty = session && !session.open ? SURFACE.closed(session.label) : SURFACE.noLive;
  const { sections } = SURFACE;
  const lanes = boot && !boot.ok ? boot : selection.reading;
  const reread = () => Promise.all([client.invalidateQueries({ queryKey: keys.boot() }), client.invalidateQueries({ queryKey: keys.lanes(venueId) })]);

  let body = null;
  if (!lanes) body = <LoadingState shape="plate" label={SURFACE.reading} />;
  else if (!lanes.ok) body = <ErrorState diagnosis={lanes.error} />;
  else if (lanes.value.lanes.length === 0) body = <EmptyState why={empty} />;
  else {
    body = (
      <>
        <SurfaceChips assets={selection.assets} asset={selection.asset} onAsset={selection.setAsset} windows={selection.windows} focalId={focal?.marketId ?? null} onFocal={selection.setFocal} nowMs={nowMs} />
        {focal ? (
          <View style={styles.sections}>
            <View>
              <SectionHead number={sections.book.number} title={sections.book.title} live />
              <BookReadout market={focal} structure={structure} hydrating={book === null} openingRaw={openingRaw} spotRaw={spotRaw} nowMs={nowMs} />
              {book?.ok && book.stale ? <StaleTick asOfMs={book.asOfMs} reason={book.staleReason} /> : null}
              {book && !book.ok ? (
                <View style={styles.mt3}>
                  <ErrorState diagnosis={book.error} />
                </View>
              ) : null}
            </View>
            <View>
              <SectionHead number={sections.depth.number} title={sections.depth.title} desc={sections.depth.desc} />
              <DepthChart depth={book?.ok ? book.value : null} hydrating={book === null} />
            </View>
            <View>
              <SectionHead number={sections.slippage.number} title={sections.slippage.title} desc={sections.slippage.desc} />
              <SlippageLadder depth={book?.ok ? book.value : null} hydrating={book === null} symbol={symbol} lotRaw={params?.ok ? params.value.lotSizeRaw : null} feeBps={fee?.ok ? fee.value : null} />
            </View>
            <View>
              <SectionHead number={sections.term.number} title={sections.term.title} desc={sections.term.desc(focal.asset)} />
              <TermStructure points={points} decimals={focal.decimals} nowMs={nowMs} focalId={focal.marketId} onPick={selection.setFocal} />
            </View>
            <Text style={[styles.basis, { color: color.inkDisabled }]}>{SURFACE.basis}</Text>
            {lanes.stale ? <StaleTick asOfMs={lanes.asOfMs} reason={lanes.staleReason} /> : null}
          </View>
        ) : null}
      </>
    );
  }

  return (
    <ExplorePage title={SURFACE.title} onRefresh={reread} style={styles.page}>
      <View style={styles.crumbs} accessibilityLabel="Breadcrumb">
        <Text style={[styles.crumb, { color: color.inkMuted }]} accessibilityRole="link" onPress={() => router.navigate("/markets")}>
          {SURFACE.crumbRoot}
        </Text>
        <Text style={[styles.crumb, { color: t.gray700 }]}>/</Text>
        <Text style={[styles.crumb, { color: color.ink }]}>{SURFACE.crumb}</Text>
      </View>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {SURFACE.title}
      </Text>
      <Text style={[styles.intro, { color: color.inkSecondary }]}>
        {SURFACE.intro.lead}
        <Text style={{ color: color.ink }}>{SURFACE.intro.em}</Text>
        {SURFACE.intro.rest}
      </Text>
      {body}
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 48 + 112 },
  crumbs: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  crumb: { fontFamily: MONO, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.98, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 40, letterSpacing: -0.9, marginBottom: 24 },
  intro: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.75, marginBottom: 32 },
  sections: { gap: 32 },
  mt3: { marginTop: 12 },
  basis: { fontFamily: MONO, fontSize: 10, lineHeight: 16, letterSpacing: 0.6 },
});
