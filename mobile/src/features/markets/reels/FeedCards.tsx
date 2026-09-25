import type { OutcomeColumn } from "@agari/core/desk";
import { TICKERS } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RECORD } from "@/features/desk/copy-record";
import { ago } from "@/features/desk/format";
import type { RecordSummaryWire } from "@/features/desk/protocol";
import { HEDGE } from "@/features/hedge/copy";
import type { HedgePick } from "@/features/hedge/hedge-target";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { holdingTokens } from "~/features/hedge/HedgeCard";
import { FONT, useTheme } from "~/theme";
import { ReelFrame } from "./ReelFrame";
import { TakeAuthor, TakeChip, TakeCta, TakeFootNote, takeStyles, TakeVoice } from "./TakeParts";
import { useReelTokens } from "./tokens";
import { openWindow } from "../openWindow";

const USD_DP = 6;

/**
 * web's `HoldingReelCard`: "You hold OpenAI. Cover it?" in the take card's frame and chip grammar, woven in once
 * every few cards. Both bets are offered as links into the ticket; nothing is preset and nothing is sent from here.
 */
export const HoldingReelCard = memo(function HoldingReelCard({ pick }: { pick: HedgePick }) {
  const t = useReelTokens();
  const { market } = pick.target;
  const name = TICKERS[pick.underlying].name;
  const value = pick.exposureUsdE6 === null ? null : `$${formatBaseUnits(pick.exposureUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
  const line = value === null ? holdingTokens(pick) : `${holdingTokens(pick)} ≈ ${value}`;
  const bet = (dir: "up" | "down") => () => openWindow(market.marketId, dir);
  return (
    <View style={styles.fill} accessibilityLabel={HEDGE.reel.aria(name)}>
      <ReelFrame>
        <TakeAuthor
          lead={<AssetDisc asset={pick.underlying} size={28} />}
          name={HEDGE.reel.title(name)}
          meta={`${laneAssetLabel(market.asset, market.lane)} · ${laneTabLabel(market.lane, market.intervalSec)} · ${HEDGE.horizon[pick.target.horizon]}`.toUpperCase()}
          badge={HEDGE.reel.badge}
        />
        <TakeChip>
          <Text style={[takeStyles.chipText, styles.shrink, { color: t.ink65 }]} numberOfLines={1}>
            {line.toUpperCase()}
          </Text>
        </TakeChip>
        <TakeVoice>{HEDGE.reel.voice}</TakeVoice>
        <View style={takeStyles.foot}>
          <View style={styles.actions}>
            <TakeCta label={HEDGE.stocks.cover} onPress={bet("down")} edge="vermilion" style={styles.grow} />
            <TakeCta label={HEDGE.stocks.add} onPress={bet("up")} style={styles.grow} />
          </View>
          <TakeFootNote>{HEDGE.reel.foot}</TakeFootNote>
        </View>
      </ReelFrame>
    </View>
  );
});

export interface DeskReelDecision {
  deskId: string;
  record: RecordSummaryWire;
  isLive: boolean;
}

const TONE: Record<OutcomeColumn, "acted" | "asked" | "quiet" | "stopped"> = {
  acted: "acted", acted_in_part: "acted", acted_by_override: "acted", would_have_acted: "acted",
  asked: "asked", nothing_to_do: "quiet", waited: "quiet", declined: "quiet",
  not_executed: "stopped", blocked_by_limit: "stopped", failed: "stopped",
};

/** web's `DeskReelCard`: your own desk's latest notable decision, in the take card's grammar, read from its record. */
export const DeskReelCard = memo(function DeskReelCard({ decision, nowSec }: { decision: DeskReelDecision; nowSec: number }) {
  const t = useReelTokens();
  const { color } = useTheme();
  const R = RECORD.hooks.reel;
  const { record } = decision;
  const tone = TONE[record.outcome as OutcomeColumn] ?? "quiet";
  const toneInk = tone === "acted" ? color.accent : tone === "asked" ? t.warning : tone === "stopped" ? color.loss : t.ink45;
  return (
    <View style={styles.fill} accessibilityLabel={`${R.title}: ${record.summary}`}>
      <ReelFrame>
        <TakeAuthor
          name={R.title}
          meta={
            <>
              <Text style={[styles.outcome, { color: toneInk }]}>
                {`${RECORD.outcome[record.outcome as OutcomeColumn] ?? record.outcome}${record.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""}`.toUpperCase()}
              </Text>
              {` · ${ago(record.decidedAtSec, nowSec)}`.toUpperCase()}
            </>
          }
          badge={R.badge}
        />
        <TakeVoice>{R.voice(record.summary)}</TakeVoice>
        <View style={takeStyles.foot}>
          <TakeCta label={R.cta} onPress={() => router.push({ pathname: "/desk/[id]/decision/[seq]", params: { id: decision.deskId, seq: String(record.seq) } })} />
          <TakeFootNote>{R.foot}</TakeFootNote>
        </View>
      </ReelFrame>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, width: "100%", alignItems: "center" },
  shrink: { flexShrink: 1 },
  actions: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
  outcome: { fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 0.88 },
});
