import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { ArrowRight, ChartColumn, Play } from "lucide-react-native";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEMO } from "@/features/demo/copy";
import { leaderboardPayloadSchema } from "@/features/leaderboard/protocol";
import { openExternal } from "~/lib/external";
import { SITE_URL } from "~/lib/env";
import { FONT, useTheme } from "~/theme";
import { demoTokens } from "~/theme/web/explore/demo";
import { Cta, Eyebrow, Headline, Reveal } from "./Parts";

const DEMO_VIDEO_ID = "iPtmue-eyIc";
const DEMO_VIDEO_URL = `https://youtu.be/${DEMO_VIDEO_ID}`;
const go = (href: Href) => router.push(href);

/** web's `.demo-bar`, sticky under the chrome: AGARI / demo, then pitch, stats and open the app. */
export function DemoBar() {
  const { name, color } = useTheme();
  const t = demoTokens(name);
  return (
    <View style={[styles.bar, { borderBottomColor: t.hair06 }]}>
      <BlurView intensity={20} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.barBg }]} />
      <Text style={[styles.brand, { color: color.ink }]}>
        {DEMO.bar.brand} <Text style={[styles.brandSub, { color: color.inkMuted }]}>{DEMO.bar.sub}</Text>
      </Text>
      <View style={styles.barLinks}>
        <Pressable onPress={() => go("/pitch")} accessibilityRole="link" hitSlop={6}>
          <Text style={[styles.barLink, { color: color.inkSecondary }]}>{DEMO.bar.pitch}</Text>
        </Pressable>
        <Pressable onPress={() => go("/stats")} accessibilityRole="link" hitSlop={6} style={styles.barLinkRow}>
          <ChartColumn size={14} color={color.inkSecondary} />
          <Text style={[styles.barLink, { color: color.inkSecondary }]}>{DEMO.bar.stats}</Text>
        </Pressable>
        <Pressable onPress={() => go("/markets")} accessibilityRole="link" hitSlop={6} style={styles.barLinkRow}>
          <Text style={[styles.barLink, { color: color.accent }]}>{DEMO.bar.open}</Text>
          <ArrowRight size={14} color={color.accent} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * web DemoVideo: the walkthrough in its 16:9 frame (min 200 tall) as the embed's poster with YouTube's play button;
 * a tap plays it on YouTube. The caption and the underlined "Watch on YouTube ↗" sit under it as on web.
 */
function DemoVideo() {
  const { name, color } = useTheme();
  const t = demoTokens(name);
  const watch = () => void openExternal(DEMO_VIDEO_URL);
  return (
    <View>
      <Pressable
        onPress={watch}
        accessibilityRole="link"
        accessibilityLabel={DEMO.video.title}
        style={[styles.video, { backgroundColor: t.videoGround, borderColor: t.hair10, boxShadow: t.frameShadow }]}
      >
        <Image source={{ uri: `https://i.ytimg.com/vi/${DEMO_VIDEO_ID}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[styles.play, { backgroundColor: t.youtubeRed }]}>
          <Play size={20} color={t.youtubeGlyph} fill={t.youtubeGlyph} />
        </View>
      </Pressable>
      <View style={styles.videoCaption}>
        <Text style={[styles.captionText, { color: color.inkSecondary }]}>{DEMO.video.caption}</Text>
        <Pressable onPress={watch} accessibilityRole="link" style={styles.watch}>
          <Text style={[styles.captionText, styles.underline, { color: color.ink }]}>{DEMO.video.watch}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** web DemoTraction: read live from `/api/leaderboard`, saying it is reading, or that the read failed. */
function Traction() {
  const { name, color } = useTheme();
  const t = demoTokens(name);
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
    ? [T.wallets(query.data.rankedTraders.toLocaleString("en-US")), T.calls(query.data.closedCalls.toLocaleString("en-US")), T.period(query.data.period), ...(query.data.complete ? [] : [T.partial]), T.live]
    : [query.isError ? T.failed : T.reading, T.live];
  return (
    <View style={[styles.traction, { borderTopColor: t.hair10 }]} accessibilityLiveRegion="polite">
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 ? <Text style={[styles.tractionText, { color: t.tractionDot }]}>·</Text> : null}
          <Text style={[styles.tractionText, { color: color.inkMuted }]}>{item}</Text>
        </Fragment>
      ))}
    </View>
  );
}

/** The three ways out — Markets, Stats, the Pitch — as web's hero and close draw them. */
export function Ctas({ big = false }: { big?: boolean }) {
  return (
    <>
      <Cta primary big={big} label={DEMO.hero.open} trail={ArrowRight} onPress={() => go("/markets")} />
      <Cta big={big} label={DEMO.hero.stats} lead={ChartColumn} onPress={() => go("/stats")} />
      <Cta big={big} label={DEMO.hero.pitch} onPress={() => go("/pitch")} />
    </>
  );
}

/** web's `.demo-hero`: eyebrow, the h1, the video, the lead, the CTAs and the traction line. */
export function DemoHero() {
  const { color } = useTheme();
  return (
    <View style={styles.hero}>
      <Eyebrow>{DEMO.hero.eyebrow}</Eyebrow>
      <Reveal>
        <Headline level="h1" lead={DEMO.hero.headline} serif={DEMO.hero.headlineSerif} />
      </Reveal>
      <Text style={[styles.videoLabel, { color: color.accent }]}>{DEMO.hero.videoLabel}</Text>
      <Reveal>
        <DemoVideo />
      </Reveal>
      <Reveal>
        <Text style={[styles.lead, { color: color.inkSecondary }]}>{DEMO.hero.lead}</Text>
      </Reveal>
      <Reveal style={styles.ctas}>
        <Ctas />
      </Reveal>
      <Reveal>
        <Traction />
      </Reveal>
    </View>
  );
}

const MONO = { fontFamily: FONT.dataRegular } as const;

const styles = StyleSheet.create({
  bar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 16, rowGap: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 56, borderBottomWidth: 1, overflow: "hidden" },
  brand: { fontFamily: FONT.headingHeavy, fontSize: 14, lineHeight: 22.4, letterSpacing: 2.52 },
  brandSub: { ...MONO, letterSpacing: 0 },
  barLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8 },
  barLinkRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLink: { ...MONO, fontSize: 12, lineHeight: 19.2 },
  hero: { paddingTop: 48, paddingHorizontal: 24, paddingBottom: 64 },
  videoLabel: { ...MONO, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 },
  video: { width: "100%", aspectRatio: 16 / 9, minHeight: 200, borderWidth: 1, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  play: { width: 68, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  videoCaption: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6, marginTop: 12 },
  captionText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  watch: { minHeight: 44, justifyContent: "center" },
  underline: { textDecorationLine: "underline" },
  lead: { fontFamily: FONT.body, fontSize: 18, lineHeight: 29.25, marginTop: 24 },
  ctas: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 36 },
  traction: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 6, marginTop: 40, paddingTop: 20, borderTopWidth: 1 },
  tractionText: { ...MONO, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.275 },
});
