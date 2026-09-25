import type { BookedOrder } from "@agari/core/ports";
import { bpsToOddsCents, formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { DealtLuckyWire, LuckyDealWire, LuckyPlacedWire } from "@/features/games/lucky/lucky-wire";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { LinkWord, LUCKY_TEXT, TxLine, useLuckyTokens } from "./parts";

/**
 * web's `LuckyPlates.tsx` (`.lk-plate`): what the machine says after the tap, or instead of a card — placed
 * (pending its Window, a profit edge), sent with no receipt, refused for a named reason, or a request that failed
 * before anything was drawn (a vermilion edge). Every plate carries a way to spin again; a placed one links the
 * transaction and the portfolio, where the position lives.
 */

function Plate({ title, placed, alert, children }: { title: string; placed: boolean; alert?: boolean; children: ReactNode }) {
  const { lk, color } = useLuckyTokens();
  return (
    <View
      style={[styles.plate, { backgroundColor: color.surface1, borderColor: placed ? lk.placedBorder : lk.refusedBorder }]}
      accessibilityLabel={title}
      accessibilityRole={alert ? "alert" : "summary"}
      accessibilityLiveRegion="polite"
    >
      <Text style={[LUCKY_TEXT.pixelTitle, { color: color.ink }]} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: ReactNode }) {
  const { color } = useLuckyTokens();
  return <Text style={[LUCKY_TEXT.body, { color: color.inkSecondary }]}>{children}</Text>;
}

export function LuckyPlacedPlate({ deal, placed, booked, symbol, onAgain }: { deal: DealtLuckyWire; placed: LuckyPlacedWire; booked: BookedOrder | null; symbol: string; onAgain: () => void }) {
  // The Window's own decimals, carried on the deal from the chain read — never a guessed six.
  const dp = deal.window.decimals;
  const words = LUCKY.placed;
  const refused = placed.result === "refused";
  const unknown = placed.result === "unknown";
  const title = refused ? LUCKY.refused.title : unknown ? words.unknownTitle : words.title;
  return (
    <Plate title={title} placed={!refused}>
      {booked ? <Body>{words.booked(formatBaseUnits(booked.contractsRaw, dp, { minDp: 0, maxDp: 2 }), SIDE_WORD[booked.side], bpsToOddsCents(booked.avgPriceBps))}</Body> : null}
      {refused ? (
        <Body>{refusalText(placed.refusal, deal)}</Body>
      ) : unknown ? (
        <Body>{words.unknown}</Body>
      ) : (
        <>
          <Body>
            {placed.costBase && placed.quantityRaw
              ? words.measured(formatBaseUnits(BigInt(placed.quantityRaw), dp, { minDp: 0, maxDp: 2 }), formatBaseUnits(BigInt(placed.costBase), dp), symbol)
              : words.notOnTape}
          </Body>
          <Body>{words.pending}</Body>
        </>
      )}
      <View style={styles.links}>
        {placed.txHash ? <TxLine label={words.tx} hash={placed.txHash} /> : null}
        {!refused ? <LinkWord label={words.portfolio} onPress={() => router.push("/portfolio")} /> : null}
        <LinkWord label={LUCKY.spin.again} onPress={onAgain} />
      </View>
    </Plate>
  );
}

function refusalText(refusal: string | null, deal: LuckyDealWire): string {
  const words = LUCKY.refused;
  switch (refusal) {
    case "no-window":
      return words.noWindow(deal.draw.asset, SIDE_WORD[deal.draw.side], deal.draw.multiplier);
    case "venue-unreadable":
      return words.unreadable;
    case "declined":
      return words.declined;
    case "nothing-filled":
      return words.nothingFilled;
    case "reverted":
      return words.reverted;
    default:
      return words.laneRefused;
  }
}

/** The scan dealt nothing: the draw stands and is shown on the reels; the reason is named. */
export function LuckyRefusedPlate({ deal, onAgain }: { deal: LuckyDealWire; onAgain: () => void }) {
  const { color } = useLuckyTokens();
  return (
    <Plate title={LUCKY.refused.title} placed={false}>
      <Body>{refusalText(deal.refusal, deal)}</Body>
      <Text style={[LUCKY_TEXT.meta, { color: color.inkMuted }]}>{LUCKY.deal.proof.nonce(deal.nonce, deal.policyVersion)}</Text>
      <View style={styles.links}>
        <LinkWord label={LUCKY.spin.again} onPress={onAgain} />
      </View>
    </Plate>
  );
}

/** A request that did not come back: nothing was drawn, or the order stands and only its record failed. */
export function LuckyFailedPlate({ message, hadDeal, onAgain }: { message: string; hadDeal: boolean; onAgain: () => void }) {
  return (
    <Plate title={hadDeal ? LUCKY.placed.unknownTitle : LUCKY.refused.title} placed={false} alert>
      <Body>{LUCKY.spin.failed(message)}</Body>
      {hadDeal ? <Body>{LUCKY.placed.unknown}</Body> : null}
      <View style={styles.links}>
        {hadDeal ? <LinkWord label={LUCKY.placed.portfolio} onPress={() => router.push("/portfolio")} /> : null}
        <LinkWord label={LUCKY.spin.again} onPress={onAgain} />
      </View>
    </Plate>
  );
}

const styles = StyleSheet.create({
  plate: { gap: 10, borderRadius: 16, padding: 20, borderWidth: 1 },
  links: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8 },
});
