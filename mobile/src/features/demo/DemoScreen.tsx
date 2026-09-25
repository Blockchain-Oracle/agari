import { useRouter, type Href } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEMO } from "@/features/demo/copy";
import { CONTRACT_PROOFS, contractProofHref, PROOF_WALLET, PROOFS_READ_ON, TX_PROOFS, txProof, txProofHref, txProofLabel } from "@/features/demo/proofs";
import { Button, Card, Screen } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { Pager, type Page } from "~/features/pitch/Pager";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Headline, InlineLink, Kicker, ProofRow, Reveal, Traction } from "./Parts";

const S = DEMO.sections;
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const DEMO_VIDEO_ID = "iPtmue-eyIc";
const DEMO_VIDEO_URL = `https://youtu.be/${DEMO_VIDEO_ID}`;

/** web DemoVideo.tsx: the walkthrough hosted on YouTube, as its poster frame in the 16:9 box; a tap plays it on YouTube. */
function DemoVideo() {
  const { color } = useTheme();
  return (
    <View style={styles.videoWrap}>
      <Text style={[styles.mono, { color: color.accent }]}>{DEMO.hero.videoLabel}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={DEMO.video.title}
        onPress={() => void openExternal(DEMO_VIDEO_URL)}
        style={[styles.video, { borderColor: color.hairline, backgroundColor: color.surface2 }]}
      >
        <Image source={{ uri: `https://i.ytimg.com/vi/${DEMO_VIDEO_ID}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[styles.play, { backgroundColor: color.accent }]}>
          <SymbolView name={{ ios: "play.fill", android: "play_arrow" }} size={22} tintColor={color.onAccent} />
        </View>
      </Pressable>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DEMO.video.caption}</Text>
      <Pressable accessibilityRole="link" onPress={() => void openExternal(DEMO_VIDEO_URL)} hitSlop={8}>
        <Text style={[TYPE.caption, { color: color.accent }]}>{DEMO.video.watch}</Text>
      </Pressable>
    </View>
  );
}

function Body({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[TYPE.body, { color: color.inkSecondary }]}>{children}</Text>;
}

/** The three ways out web's hero and close offer — Markets, Stats, the Pitch — as native routes. */
function Ctas({ go }: { go: (href: Href) => void }) {
  return (
    <View style={styles.ctas}>
      <Button label={DEMO.hero.open} onPress={() => go("/markets")} size="lg" />
      <View style={styles.ctaRow}>
        <Button label={DEMO.hero.stats} icon={{ ios: "chart.bar.fill", android: "bar_chart" }} variant="outline" onPress={() => go("/stats")} style={styles.flex} />
        <Button label={DEMO.hero.pitch} variant="outline" onPress={() => go("/pitch")} style={styles.flex} />
      </View>
    </View>
  );
}

function pages(go: (href: Href) => void): Page[] {
  const depth = [
    { glyph: { ios: "chart.bar.xaxis", android: "candlestick_chart" }, card: S.depth.cards.book, proof: txProof("fill") },
    { glyph: { ios: "scroll.fill", android: "receipt_long" }, card: S.depth.cards.receipts, proof: txProof("settlement") },
    { glyph: { ios: "chart.line.uptrend.xyaxis", android: "trending_up" }, card: S.depth.cards.edge, proof: txProof("payout") },
  ] as const;
  return [
    {
      id: "hero",
      section: DEMO.hero.eyebrow,
      render: () => (
        <>
          <Reveal>
            <Headline size="h1" lead={DEMO.hero.headline} accent={DEMO.hero.headlineSerif} />
          </Reveal>
          <Reveal i={1}>
            <DemoVideo />
          </Reveal>
          <Reveal i={2}>
            <Body>{DEMO.hero.lead}</Body>
          </Reveal>
          <Reveal i={3}>
            <Traction />
          </Reveal>
          <Reveal i={4}>
            <Ctas go={go} />
          </Reveal>
        </>
      ),
    },
    {
      id: "tap",
      section: S.tap.kicker,
      render: () => (
        <Reveal>
          <View style={styles.section}>
            <Kicker glyph={{ ios: "iphone", android: "smartphone" }}>{S.tap.kicker}</Kicker>
            <Headline lead={S.tap.headline} accent={S.tap.headlineSerif} />
            <Body>{S.tap.body}</Body>
            <InlineLink label={S.tap.link} onPress={() => go("/markets")} />
          </View>
        </Reveal>
      ),
    },
    {
      id: "reel",
      section: S.reel.kicker,
      render: () => (
        <Reveal>
          <View style={styles.section}>
            <Kicker glyph={{ ios: "bolt.fill", android: "bolt" }}>{S.reel.kicker}</Kicker>
            <Headline lead={S.reel.headline} accent={S.reel.headlineSerif} />
            <Body>{S.reel.body}</Body>
            <InlineLink label={S.reel.link} onPress={() => go("/reels")} />
          </View>
        </Reveal>
      ),
    },
    {
      id: "social",
      section: S.social.kicker,
      render: () => (
        <Reveal>
          <View style={styles.section}>
            <Kicker glyph={{ ios: "bubble.left.and.bubble.right.fill", android: "forum" }}>{S.social.kicker}</Kicker>
            <Headline lead={S.social.headline} accent={S.social.headlineSerif} />
            <Body>{S.social.body}</Body>
            <InlineLink label={S.social.room} onPress={() => go("/markets")} />
          </View>
        </Reveal>
      ),
    },
    {
      id: "depth",
      section: S.depth.kicker,
      render: () => (
        <>
          <Reveal>
            <View style={styles.section}>
              <Kicker glyph={{ ios: "chart.line.uptrend.xyaxis", android: "trending_up" }}>{S.depth.kicker}</Kicker>
              <Headline lead={S.depth.headline} accent={S.depth.headlineSerif} />
            </View>
          </Reveal>
          {depth.map(({ glyph, card, proof }, index) => (
            <Reveal key={card.title} i={index + 1}>
              <Card>
                <DepthCard glyph={glyph} title={card.title} body={card.body} />
                <ProofRow label={`${S.depth.proven} · ${txProofLabel(proof)}`} reference={proof.hash} href={txProofHref(proof)} />
              </Card>
            </Reveal>
          ))}
        </>
      ),
    },
    {
      id: "verify",
      section: S.verify.kicker,
      render: () => (
        <>
          <Reveal>
            <View style={styles.section}>
              <Kicker glyph={{ ios: "checkmark.shield.fill", android: "verified_user" }}>{S.verify.kicker}</Kicker>
              <Headline lead={S.verify.headline} accent={S.verify.headlineSerif} />
              <Body>{S.verify.body}</Body>
              <Note>{PROOF_WALLET !== null && PROOFS_READ_ON !== null ? S.verify.readOn(shortAddress(PROOF_WALLET), PROOFS_READ_ON) : S.verify.pending}</Note>
            </View>
          </Reveal>
          {TX_PROOFS.map((proof) => (
            <ProofRow
              key={proof.hash}
              label={txProofLabel(proof)}
              reference={proof.hash}
              href={txProofHref(proof)}
              note={proof.network === "fork" ? S.verify.fork : undefined}
              detail={proof.detail}
            />
          ))}
          <Note>{S.verify.contracts}</Note>
          {CONTRACT_PROOFS.map((proof) =>
            proof.address === null ? null : <ProofRow key={proof.key} label={proof.label} reference={proof.address} href={contractProofHref(proof)} />,
          )}
        </>
      ),
    },
    {
      id: "close",
      section: "close",
      render: () => (
        <Reveal>
          <View style={styles.section}>
            <Headline size="h1" lead={DEMO.close.headline} accent={DEMO.close.headlineSerif} />
            <Ctas go={go} />
            <Note>{DEMO.close.footer}</Note>
          </View>
        </Reveal>
      ),
    },
  ];
}

function DepthCard({ glyph, title, body }: { glyph: SymbolViewProps["name"]; title: string; body: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.depth}>
      <SymbolView name={glyph} size={22} tintColor={color.accent} />
      <Text style={[TYPE.title, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{body}</Text>
    </View>
  );
}

function Note({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[TYPE.caption, { color: color.inkMuted }]}>{children}</Text>;
}

/**
 * `/demo` — web DemoPage.tsx, section for section, as a paged walkthrough: the hero (the YouTube walkthrough, the
 * live traction line), the ritual, the reel, the Room, the depth with a proof per card, every devnet receipt, the
 * close. Web's screenshots of itself are left out: each section opens the native screen it describes instead.
 */
export function DemoScreen() {
  const router = useRouter();
  const go = (href: Href) => router.push(href);
  return (
    <Screen title={DEMO.title} scroll={false}>
      <Pager pages={pages(go)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  videoWrap: { gap: 8 },
  video: {
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  mono: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 1.4 },
  ctas: { gap: 10 },
  ctaRow: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  section: { gap: 14 },
  depth: { gap: 6 },
});
