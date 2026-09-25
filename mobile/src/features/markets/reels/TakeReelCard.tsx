import { formatCadence } from "@agari/core/copy";
import { assetTicker } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { addressUrl } from "@agari/core/urls";
import { router } from "expo-router";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { timeAgo } from "@/features/markets/history/time-ago";
import { captionParts } from "@/features/takes/cashtags";
import { TAKES } from "@/features/takes/copy";
import type { FeedTake } from "@/features/takes/protocol";
import { addressHue } from "@/lib/address-hue";
import { openExternal } from "~/lib/external";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { takeAvatar } from "~/theme/web/reels";
import { ReelFrame } from "./ReelFrame";
import { TakeAuthor, TakeChip, TakeCta, takeStyles, TakeVoice } from "./TakeParts";
import { useReelTokens } from "./tokens";
import { openWindow } from "../openWindow";

const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address || TAKES.anon);

const toTicker = (symbol: string) => router.push({ pathname: "/tickers/[symbol]", params: { symbol } });
const toWindow = (id: string) => openWindow(id);

/** web's `callParts`: `▲ UP · $TSLA over $359.07`, the band's asset cut off its front to be set as a cashtag. */
function callParts(take: FeedTake): { glyph: string; dir: string; tail: string } {
  const line = take.lineRaw === null ? null : assetPriceLine(take.asset, BigInt(take.lineRaw));
  const band = line === null ? TAKES.noLine(take.asset) : take.side === "up" ? TAKES.over(take.asset, line) : TAKES.under(take.asset, line);
  const tail = band.startsWith(take.asset) ? band.slice(take.asset.length) : ` ${band}`;
  return take.side === "up" ? { glyph: "▲", dir: "UP", tail } : { glyph: "▼", dir: "DOWN", tail };
}

/**
 * web's `TakeReelCard`: a take as a full-screen reel card — the caption is the hero, the call chip frames it, the
 * provenance grounds it. The author opens their profile, each `$TICKER` its hub, "verify" the author on the
 * explorer and "the Room" the Window; the CTA takes the other side while the Window is open.
 */
export const TakeReelCard = memo(function TakeReelCard({ take, nowMs }: { take: FeedTake; nowMs: number }) {
  const t = useReelTokens();
  const open = nowMs > 0 && secToMs(take.expirySec) > nowMs;
  const otherSide = take.side === "up" ? "down" : "up";
  const { glyph, dir, tail } = callParts(take);
  const hub = assetTicker(take.asset);
  const chip = [takeStyles.chipText, styles.chipShrink];
  return (
    <ReelFrame>
      <TakeAuthor
        lead={<View style={[styles.avatar, { experimental_backgroundImage: takeAvatar(addressHue(take.author)), boxShadow: `0px 0px 0px 1px ${t.ink10}` }]} />}
        name={shortAddress(take.author)}
        onName={() => router.push({ pathname: "/u/[address]", params: { address: take.author } })}
        meta={`${nowMs > 0 ? `${timeAgo(take.createdAtMs, nowMs)} · ` : ""}${TAKES.window(formatCadence(take.intervalSec))}`.toUpperCase()}
        badge={take.backed ? TAKES.backed : TAKES.openCall}
        backed={take.backed}
      />
      <TakeChip>
        <AssetDisc asset={take.asset} size={16} />
        <Text style={[takeStyles.chipText, { color: t.vermilion }]}>
          {glyph} {dir}
        </Text>
        <Text style={[takeStyles.chipText, { color: t.ink25 }]}>·</Text>
        <Text style={[chip, { color: t.ink65 }]} numberOfLines={1}>
          <Text style={{ color: t.vermilion }} onPress={hub ? () => toTicker(hub.ticker.symbol) : undefined} accessibilityRole={hub ? "link" : undefined}>
            ${take.asset}
          </Text>
          {tail.toUpperCase()}
        </Text>
      </TakeChip>
      {take.caption ? (
        <TakeVoice>
          {captionParts(take.caption).map((part, index) =>
            "symbol" in part ? (
              <Text key={index} style={{ color: t.vermilion }} onPress={() => toTicker(part.symbol)} accessibilityRole="link">
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </TakeVoice>
      ) : (
        <TakeVoice quiet>{TAKES.noNote}</TakeVoice>
      )}
      <View style={takeStyles.foot}>
        <View style={styles.prov}>
          <Text style={[styles.provText, { color: t.ink40 }]}>{TAKES.signed}</Text>
          <Text style={[styles.provText, { color: t.ink40 }]} onPress={() => void openExternal(addressUrl(take.author as Address))} accessibilityRole="link">
            {TAKES.verify}
          </Text>
          <Text style={[styles.provText, styles.room, { color: t.ink30 }]} onPress={() => toWindow(take.marketId)} accessibilityRole="link">
            {TAKES.room}
          </Text>
        </View>
        {open ? (
          <TakeCta label={TAKES.otherSide} onPress={() => openWindow(take.marketId, otherSide)} />
        ) : (
          <TakeCta label={TAKES.seeWindow} onPress={() => toWindow(take.marketId)} />
        )}
      </View>
    </ReelFrame>
  );
});

const styles = StyleSheet.create({
  avatar: { width: 36, height: 36, flexShrink: 0, borderRadius: 9999 },
  chipShrink: { flexShrink: 1 },
  prov: { marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  provText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4 },
  room: { marginLeft: "auto" },
});
