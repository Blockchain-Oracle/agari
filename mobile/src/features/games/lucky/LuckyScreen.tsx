import { LUCKY_ALLDAY_ASSETS, LUCKY_ASSETS } from "@agari/core/games";
import type { BookedOrder } from "@agari/core/ports";
import { assetTicker } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import { belowMinStake, minStakeBase } from "@agari/core/sizing";
import type { Signature } from "@agari/core/types";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet, useSigner } from "@agari/markets/react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyPlacedStatus } from "@/features/games/lucky/lucky-wire";
import { useLuckyDraw } from "@/features/games/lucky/useLuckyDraw";
import { useLuckyHistory } from "@/features/games/lucky/useLuckyHistory";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useVenue } from "@/features/markets/useVenue";
import { usePersistedState } from "@/lib/persisted";
import { useWalletSession } from "@/lib/wallet-session";
import { Eyebrow, GamesPage } from "~/features/games/frame";
import { useGameScreen, useGames } from "~/features/games/shell";
import { FONT } from "~/theme";
import { LuckyCabinet } from "./LuckyCabinet";
import { LuckyDeal } from "./LuckyDeal";
import { LuckyFailedPlate, LuckyPlacedPlate, LuckyRefusedPlate } from "./LuckyPlates";
import { LuckyReels } from "./LuckyReels";
import { LuckySide } from "./LuckySide";
import { useLuckyTokens } from "./parts";
import { reelSpin } from "./reel-sfx";

const STAKE_KEY = "agari.games.luckyStake";
const stakeCodec = { parse: (raw: string) => (/^\d*\.?\d*$/.test(raw) ? raw : null), serialize: (v: string) => v };

function sanitize(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

/**
 * web's `LuckyStage.tsx` (`/games/lucky`): the eyebrow and "Lucky." head, the cabinet (reels, stake, SPIN), then the
 * deal card or the plate the machine answered with, then the side column — the mode's sentence, the streak, the
 * ladder and the proof. Stake first; it must clear the venue's floor before the reels move, and out of hours the
 * reels draw only from the 24/7 lanes, said before they move. One tap places one real order through the Ticket lane.
 */
export function LuckyScreen() {
  const { color } = useLuckyTokens();
  const session = useWalletSession();
  const { address, hasSigner } = useSigner();
  const { boot } = useVenue();
  const { settings, feedback: cue, reducedMotion: reduced } = useGames();
  const draw = useLuckyDraw();
  const market = useMarketSession();
  const history = useLuckyHistory(address ?? null);
  const [stakeText, setStakeText] = usePersistedState(STAKE_KEY, "1", stakeCodec);
  const [skipping, setSkipping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useGameScreen("lucky");

  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const sheet = useBalanceSheet(address);
  const balances = sheet?.ok ? sheet.value : null;
  const availableBase = balances ? balances.spendableBase + balances.venueCreditBase : null;
  const stakeBase = decimals === null ? 0n : (parseDecimalToBaseUnits(stakeText, decimals) ?? 0n);
  const belowMin = decimals !== null && stakeBase > 0n && belowMinStake(stakeBase, decimals);
  const floorText = decimals === null ? "" : `${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`;

  const { phase } = draw;
  const closed = market !== null && !market.open;
  // The reels show the list the server will seal under: the 24/7 lanes alone out of hours.
  const pool = closed ? LUCKY_ALLDAY_ASSETS : LUCKY_ASSETS;
  const allDayNames = LUCKY_ALLDAY_ASSETS.map((a) => assetTicker(a)?.ticker.name ?? a);
  const busy = phase.kind === "committing" || phase.kind === "spinning";
  const atRest = phase.kind === "idle" || phase.kind === "placed" || phase.kind === "refused" || phase.kind === "failed";
  const spinBlock = !session.isConnected
    ? LUCKY.spin.connect
    : !session.isRightChain
      ? LUCKY.spin.wrongChain
      : !hasSigner || !address || decimals === null
        ? LUCKY.spin.noSigner
        : stakeBase === 0n || belowMin
          ? LUCKY.stake.minimum(floorText)
          : null;
  const canSpin = atRest && spinBlock === null;
  const spinLabel =
    phase.kind === "committing"
      ? LUCKY.spin.committing
      : phase.kind === "spinning"
        ? phase.deal
          ? LUCKY.spin.dealing
          : LUCKY.spin.spinning
        : phase.kind === "idle"
          ? LUCKY.spin.cta
          : LUCKY.spin.again;

  const onSpin = () => {
    if (!canSpin || !address) return;
    cue("tap");
    reelSpin(settings.haptics);
    draw.reset();
    void draw.spin(address, stakeBase);
  };
  const onReport = useCallback((status: LuckyPlacedStatus, txHash: Signature | null, booked: BookedOrder | null) => void draw.report(status, txHash, booked), [draw]);
  const onSkip = async () => {
    setSkipping(true);
    await draw.report("declined", null, null);
    setSkipping(false);
  };
  const onRefresh = () => {
    setRefreshing(true);
    history.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const dealt = phase.kind === "dealt" ? phase.deal : null;

  return (
    <GamesPage refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.head}>
        <Eyebrow style={styles.eyebrow}>{LUCKY.eyebrow}</Eyebrow>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {LUCKY.title}
          <Text style={{ color: color.accent }}>.</Text>
        </Text>
      </View>

      <View style={styles.layout}>
        <View style={styles.stage}>
          <LuckyCabinet
            reels={<LuckyReels cycling={draw.cycling} landing={draw.landing} target={draw.target} reduced={reduced} onLanded={draw.landed} pool={pool} />}
            stakeText={stakeText}
            onStake={(text) => setStakeText(sanitize(text))}
            symbol={symbol}
            decimals={decimals}
            availableBase={availableBase}
            belowMin={belowMin}
            floorText={floorText}
            busy={busy}
            reduced={reduced}
            spinLabel={spinLabel}
            canSpin={canSpin}
            note={spinBlock && atRest ? spinBlock : null}
            closedNote={closed && atRest ? LUCKY.spin.closed(market?.label ?? "", allDayNames.join(", ")) : null}
            onSpin={onSpin}
          />
          {dealt ? <LuckyDeal deal={dealt} symbol={symbol} onReport={onReport} onSkip={() => void onSkip()} skipping={skipping} /> : null}
          {phase.kind === "refused" ? <LuckyRefusedPlate deal={phase.deal} onAgain={draw.reset} /> : null}
          {phase.kind === "placed" ? <LuckyPlacedPlate deal={phase.deal} placed={phase.placed} booked={phase.booked} symbol={symbol} onAgain={draw.reset} /> : null}
          {phase.kind === "failed" ? <LuckyFailedPlate message={phase.message} hadDeal={phase.deal !== null} onAgain={draw.reset} /> : null}
        </View>

        <LuckySide wallet={address ?? null} feed={history.feed} watchDrawId={phase.kind === "placed" ? phase.deal.drawId : null} decimals={decimals} symbol={symbol} />
      </View>
    </GamesPage>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: 20 },
  eyebrow: { marginBottom: 12 },
  title: { marginTop: 8, fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 32, letterSpacing: -1.2 },
  layout: { gap: 16 },
  stage: { gap: 16 },
});
