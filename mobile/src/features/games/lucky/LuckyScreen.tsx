import { LUCKY_ALLDAY_ASSETS, LUCKY_ASSETS } from "@agari/core/games";
import type { BookedOrder } from "@agari/core/ports";
import { assetTicker } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import { belowMinStake, minStakeBase, quickChips } from "@agari/core/sizing";
import type { Signature } from "@agari/core/types";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet, useSigner } from "@agari/markets/react";
import { useCallback, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyPlacedStatus } from "@/features/games/lucky/lucky-wire";
import { useLuckyDraw } from "@/features/games/lucky/useLuckyDraw";
import { useLuckyHistory } from "@/features/games/lucky/useLuckyHistory";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useVenue } from "@/features/markets/useVenue";
import { usePersistedState } from "@/lib/persisted";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Card, Chips, ConnectGate, Field, Hero, Screen, SectionHeader } from "~/components/kit";
import { GameHeaderActions, useGameScreen, useGames } from "~/features/games/shell";
import { SPACE, TYPE, useTheme } from "~/theme";
import { LuckyDeal } from "./LuckyDeal";
import { LuckyHistory } from "./LuckyHistory";
import { LuckyFailedPlate, LuckyPlacedPlate, LuckyRefusedPlate } from "./LuckyPlates";
import { LuckyReels } from "./LuckyReels";
import { LuckySide } from "./LuckySide";
import { reelSpin } from "./reel-sfx";

const STAKE_KEY = "agari.games.luckyStake";
const stakeCodec = { parse: (raw: string) => (/^\d*\.?\d*$/.test(raw) ? raw : null), serialize: (v: string) => v };

function sanitize(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

/**
 * web's `LuckyStage.tsx` (`/games/lucky`): set a stake, SPIN, the three reels land on a draw two seeds made, the deal
 * card shows the Window and the live quote with the proof beside them, and one slide places one real order through
 * the same lane as every Ticket. The stake must clear the venue's floor before the reels move; out of hours the
 * reels draw only from the 24/7 lanes, and the machine says so before they move.
 */
export function LuckyScreen() {
  const { color } = useTheme();
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
  const scroll = useRef<ScrollView>(null);
  const dealY = useRef(0);
  useGameScreen("lucky");

  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const sheet = useBalanceSheet(address);
  const balances = sheet?.ok ? sheet.value : null;
  const availableBase = balances ? balances.spendableBase + balances.venueCreditBase : null;
  const stakeBase = decimals === null ? 0n : (parseDecimalToBaseUnits(stakeText, decimals) ?? 0n);
  const belowMin = decimals !== null && stakeBase > 0n && belowMinStake(stakeBase, decimals);
  // The Ticket's own quick amounts (core's fractions of what the account can spend); only the ones it can afford.
  const chips = availableBase !== null && decimals !== null ? quickChips(availableBase, decimals).filter((chip) => chip.enabled) : [];
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
  const onLanded = useCallback(() => {
    draw.landed();
    // Bring the deal (or the refusal) into view once the machine commits.
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, dealY.current - 12), animated: !reduced }), 60);
  }, [draw, reduced]);
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
    <Screen title={LUCKY.title} scroll={false} headerRight={() => <GameHeaderActions id="lucky" />}>
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} colors={[color.accent]} />}
      >
        <Hero kicker={LUCKY.eyebrow} title={`${LUCKY.title}.`} lead={LUCKY.intro} />

        <SectionHeader index="01" title="Spin" />
        <ConnectGate why={LUCKY.spin.connect}>
          <Card>
            <LuckyReels cycling={draw.cycling} landing={draw.landing} target={draw.target} reduced={reduced} onLanded={onLanded} pool={pool} />
            <View style={styles.stakeHead}>
              {availableBase !== null && decimals !== null ? (
                <Text style={[TYPE.data, { color: color.inkSecondary }]}>{LUCKY.stake.available(`${formatBaseUnits(availableBase, decimals)} ${symbol}`)}</Text>
              ) : null}
            </View>
            <Field
              label={LUCKY.stake.label}
              value={stakeText}
              onChangeText={(text) => setStakeText(sanitize(text))}
              placeholder={LUCKY.stake.placeholder}
              numeric
              suffix={symbol}
              error={belowMin ? LUCKY.stake.minimum(floorText) : null}
            />
            {decimals !== null && !busy ? (
              <Chips
                options={chips.map((chip) => ({ value: chip.label, label: chip.label }))}
                onPick={(label) => {
                  const chip = chips.find((c) => c.label === label);
                  if (chip) setStakeText(formatBaseUnits(chip.stakeBase, decimals, { group: false, minDp: 0 }));
                }}
              />
            ) : null}
            <Button label={spinLabel} size="lg" loading={busy} disabled={!canSpin} onPress={onSpin} accessibilityHint={spinBlock ?? undefined} />
            {spinBlock && atRest ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{spinBlock}</Text> : null}
            {closed && atRest ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{LUCKY.spin.closed(market?.label ?? "", allDayNames.join(", "))}</Text> : null}
          </Card>
        </ConnectGate>

        <View onLayout={(e) => (dealY.current = e.nativeEvent.layout.y)} style={styles.deal}>
          {dealt ? <LuckyDeal deal={dealt} symbol={symbol} onReport={onReport} onSkip={() => void onSkip()} skipping={skipping} /> : null}
          {phase.kind === "refused" ? <LuckyRefusedPlate deal={phase.deal} onAgain={draw.reset} /> : null}
          {phase.kind === "placed" ? <LuckyPlacedPlate deal={phase.deal} placed={phase.placed} booked={phase.booked} symbol={symbol} onAgain={draw.reset} /> : null}
          {phase.kind === "failed" ? <LuckyFailedPlate message={phase.message} hadDeal={phase.deal !== null} onAgain={draw.reset} /> : null}
        </View>

        <LuckyHistory feed={history.feed} connected={!!address} decimals={decimals} symbol={symbol} />
        <LuckySide
          wallet={address ?? null}
          feed={history.feed}
          watchDrawId={phase.kind === "placed" ? phase.deal.drawId : null}
          decimals={decimals}
          symbol={symbol}
          reduced={reduced}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 12, paddingBottom: 120, gap: 16 },
  stakeHead: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4, marginBottom: -24 },
  deal: { gap: 16 },
});
