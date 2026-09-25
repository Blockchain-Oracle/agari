import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { TicketComposer } from "@/features/markets/ticket/useTicketComposer";
import { RANGE } from "@/features/range/copy";
import { usdBand } from "@/features/range/format";
import { BandControl } from "~/features/games/range/BandControl";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { useTk } from "./tk";
import { useDrawerClose } from "~/components/drawer/BottomDrawer";

/**
 * web's Ticket in Range mode: the band control in the side block's place (the app's BandControl, the Range page's
 * own), inside only as the reference ticket offers it — "Outside" is the Range page's, so choosing it opens that page.
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

/** The CTA's words for a band: "Place RANGE $412.50 to $418.00 →", as web's button reads. */
export function rangeCtaLabel(c: TicketComposer): string {
  const { lowPrint, highPrint } = c.range.draft;
  return lowPrint !== null && highPrint !== null ? RANGE.cta.place(usdBand(lowPrint), usdBand(highPrint)) : RANGE.cta.placePlain;
}

/** web's RangePlaced: the receipt line, the transaction, the rounds page, and "another". */
export function RangePlaced({ placed, onAnother }: { placed: { txHash: string; band: string }; onAnother: () => void }) {
  const close = useDrawerClose();
  const tk = useTk();
  return (
    <View style={styles.stack} accessibilityLiveRegion="polite">
      <Text style={[styles.body, { color: tk.ink }]}>{RANGE.cta.placed(placed.band)}</Text>
      <Text style={[styles.link, { color: tk.inkSecondary }]} accessibilityRole="link" onPress={() => void openExternal(explorerUrl("tx", placed.txHash))}>
        {RANGE.ticket.viewTx}
      </Text>
      <View style={styles.row}>
        <Text
          style={[styles.link, { color: tk.vermilion }]}
          accessibilityRole="link"
          onPress={() => {
            close(() => router.navigate("/games/range"));
          }}
        >
          {RANGE.cta.rounds}
        </Text>
        <Text style={[styles.link, { color: tk.inkSecondary }]} accessibilityRole="button" onPress={onAnother}>
          {RANGE.cta.another}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23 },
  link: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85, textDecorationLine: "underline" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
});
