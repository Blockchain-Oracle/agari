import type { MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { StyleSheet, Text, View } from "react-native";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { HERO, TICKET } from "@/lib/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { WindowLine } from "~/components/window/WindowLine";
import { TYPE, useTheme } from "~/theme";
import { Countdown } from "../parts/Countdown";

/**
 * web's drawer head (TicketHeader + TicketMiniChart): which Window, its phase in words, the clock to its bell, and a
 * small live line against the strike — so the sheet never loses the thing being called.
 */
export function TicketHead({ market, phase, nowMs, chart = true }: { market: EventMarket; phase: MarketPhase | null; nowMs: number; chart?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <AssetDisc asset={market.asset} size={30} />
        <View style={styles.copy}>
          <Text style={[TYPE.title, { color: color.ink }]} numberOfLines={1}>
            {laneAssetLabel(market.asset, market.lane)} · {laneTabLabel(market.lane, market.intervalSec)}
          </Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{phase ? HERO.phase[phase] : TICKET.syncing}</Text>
        </View>
        <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} style={TYPE.dataLg} />
      </View>
      {chart ? <WindowLine market={market} height={96} bare /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1 },
});
