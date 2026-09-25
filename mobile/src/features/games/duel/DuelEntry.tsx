import { STAKE_TIERS, stakeTier, type DuelMode, type StakeTierId } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useArenaState, useBalanceSheet } from "@agari/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import { useArenaGas } from "@/features/games/duel/useArenaGas";
import { useGameSponsor } from "@/features/games/duel/useGameSponsor";
import { waitingIn, type RoomOccupancy } from "@/features/games/duel/useRoomOccupancy";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic } from "~/components/kit";
import { Cta, Press } from "~/features/games/frame";
import { FONT } from "~/theme";
import { GasRoutes } from "./DuelWaiting";
import { Blurb, Body, Foot, Key, onPhone, Plate, Refusal, useDuelTokens } from "./parts";

export interface DuelEntryProps {
  onFind: (mode: DuelMode, tier: StakeTierId) => void;
  roomOpen: boolean;
  /** Held by the stage, so a phase change that remounts the entry never resets a money choice. */
  tierId: StakeTierId;
  onTier: (tier: StakeTierId) => void;
  occupancy: RoomOccupancy | null;
}

/**
 * web's `DuelEntry.tsx`: choosing a stake, with what it costs said before anything is signed. The amounts are the
 * arena's own (`useArenaState`), the wallet's balance is compared to the pot, and the gas line names the payer —
 * the sponsor when it is ready, the player otherwise. An empty SOL tank blocks the search itself.
 */
export function DuelEntry({ onFind, roomOpen, tierId, onTier, occupancy }: DuelEntryProps) {
  const { d, color } = useDuelTokens();
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const arena = useArenaState();
  const sheet = useBalanceSheet(address);
  const { gas, recheck } = useArenaGas();
  const sponsor = useGameSponsor();

  const tier = stakeTier(tierId);
  const state = arena && isOk(arena) ? arena.value : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const index = STAKE_TIERS.findIndex((t) => t.id === tierId);
  const arenaTier = state?.tiers[index];
  const potBase = arenaTier?.potBase ?? null;
  const capBase = arenaTier?.perCardCapBase ?? null;

  const notDeployed = arena !== null && isOk(arena) && arena.value === null;
  const paused = state?.paused === true;
  // Unknown is not disabled: while the arena read is in flight the entry stays open.
  const enabled = arenaTier ? arenaTier.enabled : true;
  const spendable = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const short = potBase !== null && potBase > 0n && spendable !== null && spendable < potBase;
  const money = (base: bigint | null) => (base === null || decimals === null ? "—" : formatBaseUnits(base, decimals, { maxDp: 2, minDp: 0 }));
  const gasShort = gas.kind === "short";
  const blocked = paused || notDeployed || !enabled || short || !roomOpen || gasShort;

  return (
    <Plate>
      <View style={styles.choices}>
        <Key>{DUEL.entry.tier}</Key>
        <View style={styles.tiers} accessibilityRole="radiogroup" accessibilityLabel={DUEL.entry.tier}>
          {STAKE_TIERS.map((t) => {
            const on = t.id === tierId;
            const name = t.mode === "free" ? DUEL.entry.free : DUEL.entry.ranked;
            const amount = t.potUnits === 0 ? DUEL.entry.tierFree : DUEL.entry.tierUnits(t.potUnits, symbol);
            return (
              <Press
                key={t.id}
                onPress={() => {
                  if (on) return;
                  haptic.select();
                  onTier(t.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${name}, ${amount}`}
                style={[styles.tier, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? d.tierOnBg : "transparent" }]}
              >
                <Text style={[styles.tierName, { color: color.inkMuted }]}>{name.toUpperCase()}</Text>
                <Text style={[styles.tierAmount, { color: color.ink }]}>{amount}</Text>
              </Press>
            );
          })}
        </View>
        <Blurb>{tier.mode === "free" ? DUEL.entry.freeBlurb : DUEL.entry.rankedBlurb}</Blurb>
        {occupancy?.reachable ? <Foot>{DUEL.entry.queueHere(waitingIn(occupancy, tier.mode, tierId))}</Foot> : null}
      </View>

      <View style={styles.cost}>
        <Key>{DUEL.entry.cost}</Key>
        <View style={styles.costList}>
        {[
          tier.potUnits === 0 ? DUEL.entry.costNoPot : DUEL.entry.costPot(money(potBase), symbol),
          DUEL.entry.costCards(money(capBase), symbol),
          sponsor.ready ? DUEL.entry.costGasSponsored : DUEL.entry.costGas,
        ].map((line) => (
          <Text key={line} style={[styles.costLine, { color: color.inkSecondary }]}>
            {onPhone(line)}
          </Text>
        ))}
        </View>
      </View>

      {notDeployed ? <Refusal>{DUEL.entry.notDeployed}</Refusal> : null}
      {paused ? <Refusal>{DUEL.entry.paused}</Refusal> : null}
      {!paused && !notDeployed && !enabled ? <Refusal>{DUEL.entry.tierDisabled}</Refusal> : null}
      {short ? <Refusal>{DUEL.entry.balanceShort(money(potBase), money(spendable), symbol)}</Refusal> : null}
      {gasShort ? (
        <Refusal>
          <Body>{sponsor.ready ? DUEL.entry.gasShortSponsored : DUEL.entry.gasShort}</Body>
          <GasRoutes onRecheck={() => void recheck()} />
        </Refusal>
      ) : null}
      <Cta label={roomOpen ? DUEL.entry.find : DUEL.entry.waitingRoom} disabled={blocked} onPress={() => onFind(tier.mode, tierId)} />
    </Plate>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 8 },
  tiers: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tier: { width: "48.5%", flexGrow: 1, alignItems: "flex-start", gap: 2, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  tierName: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.9 },
  tierAmount: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  cost: { gap: 6 },
  costList: { gap: 6, paddingLeft: 16 },
  costLine: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
});
