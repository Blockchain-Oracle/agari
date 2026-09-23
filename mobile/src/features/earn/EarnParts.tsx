import type { ReserveSheet } from "@agari/core/reserves";
import { Text, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import type { ReserveWords } from "@/features/earn/reserves";
import { Card, EmptyState } from "~/components/kit";
import { TitleHero } from "~/features/short/PageParts";
import { TYPE, useTheme } from "~/theme";
import { ReservePanel } from "./ReservePanel";

/** web's `features/earn/Hero.tsx`: "Earn the <accent>." over the tab's blurb, then the live panel. */
export function EarnHero({ words, sheet, symbol, status }: { words: ReserveWords; sheet: ReserveSheet | null; symbol: string; status?: string }) {
  return (
    <View style={{ gap: 16 }}>
      <TitleHero eyebrow={words.label} title={EARN.title} accent={words.accent} lead={words.blurb} />
      <ReservePanel sheet={sheet} symbol={symbol} words={words} status={status} />
    </View>
  );
}

/** web's `NotDeployed` for the maker vault. */
export function NotDeployed() {
  const { notDeployed } = EARN;
  return <EmptyState why={`${notDeployed.title} · needs ${notDeployed.dependency}`} detail={`${notDeployed.body}\n\n${notDeployed.why}`} />;
}

/** web's `.ea-paused` callout. */
export function PausedNote({ body }: { body: string }) {
  const { color } = useTheme();
  return (
    <Card tone="accent">
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{EARN.paused.title}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{body}</Text>
    </Card>
  );
}

/** web's `.ea-msg`: the last write's result, "Done ✓" in profit ink, a refusal in loss ink. */
export function Message({ text }: { text: string }) {
  const { color } = useTheme();
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: text.includes("✓") ? color.profit : color.loss }]}>
      {text}
    </Text>
  );
}
