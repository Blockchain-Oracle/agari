import { useQuery } from "@tanstack/react-query";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { DEMO } from "@/features/demo/copy";
import { leaderboardPayloadSchema } from "@/features/leaderboard/protocol";
import { haptic } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { SITE_URL } from "~/lib/env";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web DemoBlocks.tsx `Reveal`: a block rises in as its page arrives. */
export function Reveal({ i = 0, children }: { i?: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.delay(i * 90).duration(380)}>{children}</Animated.View>;
}

/** web `Kicker`: the section's glyph and mono line ("01 · the ritual"). */
export function Kicker({ glyph, children }: { glyph: SymbolViewProps["name"]; children: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.kicker}>
      <SymbolView name={glyph} size={15} tintColor={color.accent} />
      <Text style={[styles.kickerText, { color: color.accent }]}>{children.toUpperCase()}</Text>
    </View>
  );
}

/** web `demo-h2` with its `Serif` half: the second half set apart in vermilion (the app has no serif face for it). */
export function Headline({ lead, accent, size = "h2" }: { lead: string; accent: string; size?: "h1" | "h2" }) {
  const { color } = useTheme();
  return (
    <Text style={[size === "h1" ? TYPE.display : TYPE.headline, { color: color.ink }]} accessibilityRole="header">
      {lead}
      <Text style={{ color: color.accent }}>{accent}</Text>
    </Text>
  );
}

/** web `demo-inline-link`: a text action with an arrow, opening a native screen. */
export function InlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="link"
      hitSlop={8}
      style={styles.inline}
    >
      <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{label}</Text>
      <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={13} tintColor={color.accent} />
    </Pressable>
  );
}

/**
 * web DemoBlocks.tsx `ProofLink` / `ProofCode`: a proof's label and the head of its hash. A devnet proof opens on
 * Solana Explorer; a fork proof has no explorer page, so it prints where it ran instead.
 */
export function ProofRow({ label, reference, href, note, detail }: { label: string; reference: string; href: string | null; note?: string; detail?: string }) {
  const { color } = useTheme();
  const body = (
    <>
      <View style={styles.proofHead}>
        <SymbolView
          name={href ? { ios: "arrow.up.right.square", android: "open_in_new" } : { ios: "chevron.left.forwardslash.chevron.right", android: "code" }}
          size={15}
          tintColor={href ? color.accent : color.inkMuted}
        />
        <Text style={[TYPE.bodyStrong, styles.proofLabel, { color: color.ink }]}>{label}</Text>
        <Text style={[TYPE.data, styles.hash, { color: color.inkMuted }]}>{reference.slice(0, 8)}…</Text>
      </View>
      {note ? <Text style={[TYPE.data, styles.hash, { color: color.warning }]}>{note}</Text> : null}
      {detail ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{detail}</Text> : null}
    </>
  );
  const frame = [styles.proof, { backgroundColor: color.surface1, borderColor: color.hairline }];
  if (!href) return <View style={frame}>{body}</View>;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        void openExternal(href);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${label}, open on Solana Explorer`}
      style={({ pressed }) => [frame, pressed && { opacity: 0.85 }]}
    >
      {body}
    </Pressable>
  );
}

/**
 * web DemoTraction.tsx: the traction line read live from `/api/leaderboard` — the same venue scan the board runs —
 * saying it is reading, or that the read failed, rather than show a figure it does not have.
 */
export function Traction() {
  const { color } = useTheme();
  const query = useQuery({
    queryKey: ["agari", "demo", "traction"],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${SITE_URL}/api/leaderboard`, { signal });
      if (!response.ok) throw new Error(String(response.status));
      return leaderboardPayloadSchema.parse(await response.json()).meta;
    },
    staleTime: 180_000,
  });
  const T = DEMO.traction;
  const items = query.data
    ? [
        T.wallets(query.data.rankedTraders.toLocaleString("en-US")),
        T.calls(query.data.closedCalls.toLocaleString("en-US")),
        T.period(query.data.period),
        ...(query.data.complete ? [] : [T.partial]),
        T.live,
      ]
    : [query.isError ? T.failed : T.reading, T.live];
  return (
    <Text style={[TYPE.data, styles.traction, { color: color.inkSecondary }]} accessibilityLiveRegion="polite">
      {items.join("  ·  ")}
    </Text>
  );
}

const styles = StyleSheet.create({
  kicker: { flexDirection: "row", alignItems: "center", gap: 8 },
  kickerText: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 1.6 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" },
  proof: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  proofHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  proofLabel: { flex: 1, fontSize: 14 },
  hash: { fontSize: 11.5 },
  traction: { fontSize: 12, lineHeight: 18 },
});
