import { formatBaseUnits, shortHex } from "@agari/core/units";
import * as Clipboard from "expo-clipboard";
import { SymbolView } from "expo-symbols";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { DUEL } from "@/features/games/duel/copy";
import type { DuelCard } from "@/features/games/duel/duel-card";
import { SHARE } from "@/features/share/copy";
import { Button, haptic } from "~/components/kit";
import { fireFeedback } from "~/games/feedback";
import { FONT, TYPE, useTheme } from "~/theme";
import { Avatar } from "./parts";

/** web's `duelShareUrl` (duel-card.ts also draws the canvas card, so it cannot be imported here). */
export function duelShareUrl(matchId: string): string {
  return `${SHARE.siteUrl}/games/duel/${matchId}`;
}

/**
 * web's `DuelResultModal.tsx` as a native page sheet: the verdict stamp, the return, the two seats, three figures,
 * share and copy link. The share renders the card to a PNG (react-native-view-shot) for the system sheet (expo-sharing).
 */
export function DuelResultModal({ open, onClose, card }: { open: boolean; onClose: () => void; card: DuelCard }) {
  const { color } = useTheme();
  const words = DUEL.result.modal;
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const returnText = card.returnPct === null ? null : `${card.returnPct > 0 ? "+" : ""}${card.returnPct}%`;
  const money = (base: bigint) => formatBaseUnits(base, card.decimals, { maxDp: 2, minDp: 2 });
  const url = duelShareUrl(card.matchId);
  const ink = card.verdict === "won" ? color.accent : card.verdict === "lost" ? color.inkMuted : color.ink;
  const close = () => {
    fireFeedback("modal-close", { haptics: false });
    onClose();
  };
  const text = words.shareText(card.verdict, returnText, url);
  /** The card as a PNG through the system sheet (web renders it to a canvas); the text and link if that is unavailable. */
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
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.sheet, { backgroundColor: color.ground }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={words.close} hitSlop={10} style={styles.close}>
          <SymbolView name={{ ios: "xmark.circle.fill", android: "close" }} size={28} tintColor={color.inkMuted} />
        </Pressable>

        <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor: color.surface1, borderColor: card.verdict === "won" ? color.accent : color.hairline }]}>
          <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{words.eyebrow.toUpperCase()}</Text>
          <Text style={[TYPE.stampHero, styles.verdict, { color: ink }]} accessibilityRole="header">
            {words.verdict[card.verdict]}
          </Text>
          {returnText ? <Text style={[TYPE.dataHero, { color: ink }]}>{returnText}</Text> : null}
          <View style={styles.seats}>
            <View style={styles.seat}>
              <Avatar address={card.you} size={64} />
              <Text style={[styles.addr, { color: color.inkSecondary }]}>{card.you ? shortHex(card.you, 4, 4) : "—"}</Text>
            </View>
            <Text style={[styles.vs, { color: color.inkMuted }]}>VS</Text>
            <View style={styles.seat}>
              <Avatar address={card.opponent} size={64} />
              <Text style={[styles.addr, { color: color.inkSecondary }]}>{card.opponent ? shortHex(card.opponent, 4, 4) : "—"}</Text>
            </View>
          </View>
          <View style={styles.stats}>
            <Stat value={`${card.hits}/${card.total}`} label={words.hits} />
            {card.free ? (
              <Stat value={words.free} label={words.pot} wide />
            ) : (
              <>
                <Stat
                  value={card.pnlBase === null ? "—" : `${card.pnlBase > 0n ? "+" : card.pnlBase < 0n ? "−" : ""}${money(card.pnlBase < 0n ? -card.pnlBase : card.pnlBase)}`}
                  label={words.pnl}
                />
                <Stat value={card.potAwardedBase === null ? "—" : money(card.potAwardedBase)} label={words.pot} />
              </>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <Button label={sharing ? words.sharing : words.share} loading={sharing} size="lg" onPress={() => void share()} icon={{ ios: "square.and.arrow.up", android: "share" }} />
          <Button label={copied ? words.copied : words.copy} variant="outline" onPress={copy} icon={{ ios: "link", android: "link" }} />
        </View>
      </View>
    </Modal>
  );
}

function Stat({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={[styles.stat, wide && styles.statWide, { backgroundColor: color.surface2 }]}>
      <Text style={[styles.statValue, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statKey, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: 20, paddingTop: 56, gap: 20 },
  close: { position: "absolute", top: 14, right: 16, width: 44, height: 44, alignItems: "center", justifyContent: "center", zIndex: 2 },
  card: { alignItems: "center", gap: 14, borderRadius: 20, borderWidth: 1, padding: 22 },
  eyebrow: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 2.4 },
  verdict: { textAlign: "center" },
  seats: { flexDirection: "row", alignItems: "center", gap: 20 },
  seat: { alignItems: "center", gap: 6 },
  addr: { fontFamily: FONT.data, fontSize: 11 },
  vs: { fontFamily: FONT.data, fontSize: 16, letterSpacing: 3 },
  stats: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center", gap: 4, borderRadius: 8, padding: 10 },
  statWide: { flex: 2 },
  statValue: { fontFamily: FONT.dataStrong, fontSize: 20, fontVariant: ["tabular-nums"] },
  statKey: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1.2 },
  actions: { gap: 10 },
});
