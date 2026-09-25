import * as Sharing from "expo-sharing";
import { useState, type RefObject } from "react";
import { Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { SHARE } from "@/features/share/copy";
import { Button, haptic } from "~/components/kit";

/**
 * The share control under The Call and the verdict receipt (web's ShareCallButton / ShareTradeButton): the card on
 * screen captured as a PNG and handed to the system share sheet, with web's pre-filled post (`buildCallTweetText`,
 * `buildTradeTweetText` — real staked numbers only) as its message. Where the image cannot be made or shared, the
 * text goes alone.
 */
export function ShareButton({ text, card, label = SHARE.shareCard, tone = "outline" }: { text: string; card?: RefObject<View | null>; label?: string; tone?: "outline" | "secondary" }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const target = card?.current ?? null;
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
  return <Button label={busy ? SHARE.rendering : `${label} ↗`} variant={tone} size="sm" loading={busy} onPress={() => void share()} />;
}
