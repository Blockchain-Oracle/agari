import { useState } from "react";
import { Share } from "react-native";
import { SHARE } from "@/features/share/copy";
import { Button, haptic } from "~/components/kit";

/**
 * The share control under The Call and the verdict receipt: web's pre-filled post (`buildCallTweetText`,
 * `buildTradeTweetText` — real staked numbers only) handed to the system share sheet. The rendered image card rides
 * on react-native-view-shot, which this dev client does not carry yet, so the sheet takes the text.
 */
export function ShareButton({ text, label = SHARE.shareCard, tone = "outline" }: { text: string; label?: string; tone?: "outline" | "secondary" }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await Share.share({ message: text });
      if (result.action === Share.sharedAction) haptic.success();
    } finally {
      setBusy(false);
    }
  };
  return <Button label={label} variant={tone} size="sm" icon={{ ios: "square.and.arrow.up", android: "share" }} loading={busy} onPress={() => void share()} />;
}
