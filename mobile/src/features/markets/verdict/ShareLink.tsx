import * as Sharing from "expo-sharing";
import { useState, type RefObject } from "react";
import { Pressable, Share, StyleSheet, Text, type View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { SHARE } from "@/features/share/copy";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";

/**
 * web's ShareTradeButton (`.share-link` "Share card ↗": 10 pt mono caps in secondary ink). Web renders the trade card
 * to a PNG; the phone captures the receipt on screen and hands it to the share sheet with web's pre-filled post, and
 * sends the text alone where the image cannot be made.
 */
export function ShareLink({ card, text }: { card: RefObject<View | null>; text: string }) {
  const { color } = useTheme();
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const target = card.current;
      const image = target && (await Sharing.isAvailableAsync()) ? await captureRef(target, { format: "png", quality: 1, result: "tmpfile" }).catch(() => null) : null;
      if (image) {
        await Sharing.shareAsync(image, { mimeType: "image/png", UTI: "public.png", dialogTitle: text });
        haptic.success();
        return;
      }
      const result = await Share.share({ message: text });
      if (result.action === Share.sharedAction) haptic.success();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={() => void share()} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }} hitSlop={10} style={{ opacity: busy ? 0.5 : 1 }}>
      {({ pressed }) => <Text style={[styles.link, { color: pressed ? color.accent : color.inkSecondary }]}>{busy ? SHARE.rendering : `${SHARE.shareCard} ↗`}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
});
