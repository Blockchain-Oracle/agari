import type { Signature } from "@agari/core/types";
import type { BookedOrder } from "@agari/core/ports";
import { bpsToOddsCents, formatBaseUnits, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { DealtLuckyWire, LuckyDealWire, LuckyPlacedWire } from "@/features/games/lucky/lucky-wire";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { Button, Card } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { TYPE, useTheme } from "~/theme";

/**
 * web's `LuckyPlates.tsx`: what the machine says after the slide, or instead of a card — placed (pending its
 * Window), sent with no receipt, refused for a named reason, or a request that failed before anything was drawn.
 * Every plate offers another spin; a placed one opens the transaction and the portfolio, where the position lives.
 */

function Plate({ title, tone, children }: { title: string; tone: "placed" | "refused"; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <Card tone={tone === "placed" ? "cream" : "plain"}>
      <Text style={[TYPE.stamp, { color: tone === "placed" ? color.creamInk : color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Card>
  );
}

function Body({ children, cream }: { children: ReactNode; cream?: boolean }) {
  const { color } = useTheme();
  return <Text style={[TYPE.body, { color: cream ? color.creamInk : color.inkSecondary }]}>{children}</Text>;
}

function TxButton({ txHash }: { txHash: Signature }) {
  return (
    <Button
      label={`${LUCKY.placed.tx} ${shortHex(txHash, 6, 4)}`}
      variant="secondary"
      size="sm"
      icon={{ ios: "arrow.up.right.square", android: "open_in_new" }}
      onPress={() => void openExternal(txUrl(txHash))}
    />
  );
}

export function LuckyPlacedPlate({ deal, placed, booked, symbol, onAgain }: { deal: DealtLuckyWire; placed: LuckyPlacedWire; booked: BookedOrder | null; symbol: string; onAgain: () => void }) {
  // The Window's own decimals, carried on the deal from the chain read — never a guessed six.
  const dp = deal.window.decimals;
  const words = LUCKY.placed;
  const refused = placed.result === "refused";
  const unknown = placed.result === "unknown";
  const title = refused ? LUCKY.refused.title : unknown ? words.unknownTitle : words.title;
  const cream = !refused && !unknown;
  return (
    <Plate title={title} tone={cream ? "placed" : "refused"}>
      {booked ? <Body cream={cream}>{words.booked(formatBaseUnits(booked.contractsRaw, dp, { minDp: 0, maxDp: 2 }), SIDE_WORD[booked.side], bpsToOddsCents(booked.avgPriceBps))}</Body> : null}
      {refused ? <Body>{refusalText(placed.refusal, deal)}</Body> : null}
      {unknown ? <Body>{words.unknown}</Body> : null}
      {cream ? (
        <>
          <Body cream>
            {placed.costBase && placed.quantityRaw
              ? words.measured(formatBaseUnits(BigInt(placed.quantityRaw), dp, { minDp: 0, maxDp: 2 }), formatBaseUnits(BigInt(placed.costBase), dp), symbol)
              : words.notOnTape}
          </Body>
          <Body cream>{words.pending}</Body>
        </>
      ) : null}
      <View style={styles.actions}>
        {placed.txHash ? <TxButton txHash={placed.txHash} /> : null}
        {!refused ? <Button label={words.portfolio} variant="secondary" size="sm" onPress={() => router.push("/portfolio")} /> : null}
        <Button label={LUCKY.spin.again} size="sm" onPress={onAgain} />
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
  const { color } = useTheme();
  return (
    <Plate title={LUCKY.refused.title} tone="refused">
      <Body>{refusalText(deal.refusal, deal)}</Body>
      <Text style={[TYPE.data, { color: color.inkMuted }]}>{LUCKY.deal.proof.nonce(deal.nonce, deal.policyVersion)}</Text>
      <Button label={LUCKY.spin.again} size="sm" onPress={onAgain} />
    </Plate>
  );
}

/** A request that did not come back: nothing was drawn, or the order stands and only its record failed. */
export function LuckyFailedPlate({ message, hadDeal, onAgain }: { message: string; hadDeal: boolean; onAgain: () => void }) {
  return (
    <Plate title={hadDeal ? LUCKY.placed.unknownTitle : LUCKY.refused.title} tone="refused">
      <Body>{LUCKY.spin.failed(message)}</Body>
      {hadDeal ? <Body>{LUCKY.placed.unknown}</Body> : null}
      <View style={styles.actions}>
        {hadDeal ? <Button label={LUCKY.placed.portfolio} variant="secondary" size="sm" onPress={() => router.push("/portfolio")} /> : null}
        <Button label={LUCKY.spin.again} size="sm" onPress={onAgain} />
      </View>
    </Plate>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
});
