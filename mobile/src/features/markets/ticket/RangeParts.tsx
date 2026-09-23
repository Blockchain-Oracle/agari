import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { TicketComposer } from "@/features/markets/ticket/useTicketComposer";
import { RANGE } from "@/features/range/copy";
import { formatProbE6, usdBand } from "@/features/range/format";
import { Button } from "~/components/kit";
import { BandControl } from "~/features/games/range/BandControl";
import { explorerUrl, openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";
import type { TicketReview } from "./review";

/** RANGE's labels carry web's trailing arrow; a native button draws none. */
const plain = (label: string) => label.replace(/\s*→$/, "");

/**
 * web's Ticket in Range mode: the band control in the side block's place (the app's own native BandControl), inside
 * only as the reference ticket offers it — "Outside" is the Range page's, so choosing it opens that page.
 */
export function RangeBand({ c }: { c: TicketComposer }) {
  return (
    <BandControl
      asset={c.market.asset}
      intervalSec={c.market.intervalSec}
      draft={c.range.draft}
      side="inside"
      onSide={(side) => (side === "outside" ? router.push("/games/range") : undefined)}
      spot={c.range.spot}
      onDragging={() => undefined}
    />
  );
}

/** The CTA's words for a band: "Place RANGE $412.50 to $418.00". */
export function rangeCtaLabel(c: TicketComposer): string {
  const { lowPrint, highPrint } = c.range.draft;
  return plain(lowPrint !== null && highPrint !== null ? RANGE.cta.place(usdBand(lowPrint), usdBand(highPrint)) : RANGE.cta.placePlain);
}

/** The review before a band's slide: the stake (the most it can lose), what it pays at most, the chance inside. */
export function rangeReview(c: TicketComposer): TicketReview | null {
  const q = c.range.quote;
  const { lowPrint, highPrint } = c.range.draft;
  if (!q || lowPrint === null || highPrint === null) return null;
  const money = (base: bigint) => `${formatBaseUnits(base, c.decimals)} ${c.symbol}`;
  return {
    title: `RANGE ${usdBand(lowPrint)} – ${usdBand(highPrint)} · ${c.market.asset}`,
    lines: [
      { label: "Stake", value: money(q.stakeBase) },
      { label: "Pays at most", value: money(q.maxPayoutBase), tone: "profit" },
      { label: "Chance inside", value: formatProbE6(q.insideProbE6), tone: "accent" },
    ],
    maxLoss: money(q.stakeBase),
    confirmLabel: "Slide to place the band",
    cta: rangeCtaLabel(c),
  };
}

/** web's RangePlaced: the receipt line, the transaction, the rounds page, and "another". */
export function RangePlacedCard({ placed, onAnother }: { placed: { txHash: string; band: string }; onAnother: () => void }) {
  const { color } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: color.cream }]} accessibilityRole="summary">
      <Text style={[TYPE.bodyStrong, { color: color.creamInk }]}>{RANGE.cta.placed(placed.band)}</Text>
      <Button label={RANGE.ticket.viewTx} variant="ghost" size="sm" onPress={() => openExternal(explorerUrl("tx", placed.txHash))} />
      <View style={styles.row}>
        <Button label={RANGE.cta.rounds} variant="secondary" style={styles.grow} onPress={() => router.push("/games/range")} />
        <Button label={RANGE.cta.another} variant="outline" style={styles.grow} onPress={onAnother} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, padding: 18, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
});
