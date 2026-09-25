import { formatBaseUnits, shortHex } from "@agari/core/units";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { DUEL } from "@/features/games/duel/copy";
import type { DuelCard } from "@/features/games/duel/duel-card";
import { SHARE } from "@/features/share/copy";
import { haptic } from "~/components/kit";
import { Cta, GameModal } from "~/features/games/frame";
import { fireFeedback } from "~/games/feedback";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { Avatar, useDuelTokens } from "./parts";

/** web's `duelShareUrl` (duel-card.ts also draws the canvas card, so it cannot be imported here). */
export function duelShareUrl(matchId: string): string {
  return `${SHARE.siteUrl}/games/duel/${matchId}`;
}

/**
 * web's `DuelResultModal.tsx` (Flicky's result modal) in the shell's overlay grammar: the verdict at 44 in the pixel
 * face, tracked and in the verdict's colour, the return beneath it, two 64 px seats around "vs", three figures in
 * their wells, then "share image" and "copy link". The share renders the plate to a PNG for the system sheet.
 */
export function DuelResultModal({ open, onClose, card }: { open: boolean; onClose: () => void; card: DuelCard }) {
  const { d, color } = useDuelTokens();
  const words = DUEL.result.modal;
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (!open) return;
    fireFeedback("modal-open", { haptics: false });
  }, [open]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const returnText = card.returnPct === null ? null : `${card.returnPct > 0 ? "+" : ""}${card.returnPct}%`;
  const money = (base: bigint) => formatBaseUnits(base, card.decimals, { maxDp: 2, minDp: 2 });
  const url = duelShareUrl(card.matchId);
  const ink = card.verdict === "won" ? color.profit : card.verdict === "lost" ? color.loss : color.ink;
  const close = () => {
    fireFeedback("modal-close", { haptics: false });
    onClose();
  };
  const text = words.shareText(card.verdict, returnText, url);
  /** The plate as a PNG through the system sheet (web renders its card to a canvas); the text and link if that fails. */
  const share = async () => {
    haptic.tap();
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: text });
        return;
      }
      await Share.share({ message: text, url });
    } catch {
      await Share.share({ message: text, url }).catch(() => undefined);
    } finally {
      setSharing(false);
    }
  };
  const copy = () => {
    void Clipboard.setStringAsync(url).then(() => {
      haptic.success();
      setCopied(true);
    });
  };

  return (
    <GameModal open={open} onClose={close} closeLabel={words.close}>
      <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor: color.surface1 }]}>
        <Text style={[styles.verdict, { color: ink }]} accessibilityRole="header">
          {words.verdict[card.verdict].toUpperCase()}
        </Text>
        {returnText ? <Text style={[styles.return, { color: ink }]}>{returnText}</Text> : null}
        <View style={styles.seats}>
          <View accessibilityLabel={card.you ? shortHex(card.you, 6, 4) : undefined}>
            <Avatar address={card.you} size={64} />
          </View>
          <Text style={[styles.vs, { color: color.inkMuted }]}>VS</Text>
          <View accessibilityLabel={card.opponent ? shortHex(card.opponent, 6, 4) : undefined}>
            <Avatar address={card.opponent} size={64} />
          </View>
        </View>
        <View style={styles.stats}>
          <Stat value={`${card.hits}/${card.total}`} label={words.hits} well={d.statBg} />
          {card.free ? (
            <View style={[styles.stat, styles.wide, { backgroundColor: d.statBg }]}>
              <Text style={[styles.soft, { color: color.inkSecondary }]}>{words.free.toUpperCase()}</Text>
            </View>
          ) : (
            <>
              <Stat
                value={card.pnlBase === null ? "—" : `${card.pnlBase > 0n ? "+" : card.pnlBase < 0n ? "−" : ""}${money(card.pnlBase < 0n ? -card.pnlBase : card.pnlBase)}`}
                label={words.pnl}
                well={d.statBg}
              />
              <Stat value={card.potAwardedBase === null ? "—" : money(card.potAwardedBase)} label={words.pot} well={d.statBg} />
            </>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <Cta label={sharing ? words.sharing : words.share} disabled={sharing} onPress={() => void share()} />
        <Cta label={copied ? words.copied : words.copy} variant="quiet" onPress={copy} />
      </View>
    </GameModal>
  );
}

/** `.du-modal-stat`: the figure at 22 and its label at 11, both in the pixel face, in a radius-8 well. */
function Stat({ value, label, well }: { value: string; label: string; well: string }) {
  const { color } = useDuelTokens();
  return (
    <View style={[styles.stat, { backgroundColor: well }]}>
      <Text style={[styles.statValue, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statKey, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 20 },
  verdict: { textAlign: "center", fontFamily: PIXEL_FONT, fontSize: 44, lineHeight: 44, letterSpacing: 7.04 },
  return: { marginTop: -8, textAlign: "center", fontFamily: PIXEL_FONT, fontSize: 44, lineHeight: 44, fontVariant: ["tabular-nums"] },
  seats: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  vs: { fontFamily: FONT.dataRegular, fontSize: 18, letterSpacing: 3.6 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", gap: 4, borderRadius: 8, padding: 8 },
  wide: { flex: 2, justifyContent: "center" },
  statValue: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, fontVariant: ["tabular-nums"] },
  statKey: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 13, letterSpacing: 1.65 },
  soft: { fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 14, letterSpacing: 1.8 },
  actions: { gap: 8 },
});
