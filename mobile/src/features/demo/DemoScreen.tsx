import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { ArrowRight, ChartCandlestick, MessageSquare, ScrollText, ShieldCheck, Smartphone, TrendingUp, Zap } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DEMO } from "@/features/demo/copy";
import { CONTRACT_PROOFS, contractProofHref, PROOF_WALLET, PROOFS_READ_ON, TX_PROOFS, txProof, txProofHref, txProofLabel } from "@/features/demo/proofs";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { demoTokens } from "~/theme/web/explore/demo";
import { Ctas, DemoBar, DemoHero } from "./Hero";
import { Body, Frame, Headline, InlineLink, Kicker, ProofLink, ProofNote, Reveal } from "./Parts";

const S = DEMO.sections;
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const go = (href: Href) => router.push(href);

/** The three depth cards (`.demo-card`), each citing the transaction that proves it. */
function DepthCards() {
  const { name, color } = useTheme();
  const t = demoTokens(name);
  const cards = [
    { Icon: ChartCandlestick, card: S.depth.cards.book, proof: txProof("fill") },
    { Icon: ScrollText, card: S.depth.cards.receipts, proof: txProof("settlement") },
    { Icon: TrendingUp, card: S.depth.cards.edge, proof: txProof("payout") },
  ];
  return (
    <View style={styles.cards}>
      {cards.map(({ Icon, card, proof }) => (
        <Reveal key={card.title}>
          <View style={[styles.card, { borderColor: t.hair08 }]}>
            <LinearGradient colors={[t.wash, t.washEnd]} style={StyleSheet.absoluteFill} />
            <Icon size={24} color={color.accent} />
            <Text style={[styles.cardTitle, { color: color.ink }]}>{card.title}</Text>
            <Text style={[styles.cardBody, { color: color.inkSecondary }]}>{card.body}</Text>
            <View style={styles.cardProof}>
              <ProofLink href={txProofHref(proof)} label={`${S.depth.proven} · ${txProofLabel(proof)}`} reference={proof.hash} />
            </View>
          </View>
        </Reveal>
      ))}
    </View>
  );
}

/** Section 05: the receipts of one Window's life, then the programs every Window runs on. */
function Verify() {
  return (
    <View style={styles.section}>
      <Reveal>
        <Kicker icon={ShieldCheck}>{S.verify.kicker}</Kicker>
        <Headline level="h2" lead={S.verify.headline} serif={S.verify.headlineSerif} />
        <Body wide>{S.verify.body}</Body>
        <ProofNote>{PROOF_WALLET !== null && PROOFS_READ_ON !== null ? S.verify.readOn(shortAddress(PROOF_WALLET), PROOFS_READ_ON) : S.verify.pending}</ProofNote>
      </Reveal>
      <View style={styles.proofs}>
        {TX_PROOFS.map((proof) => (
          <Reveal key={proof.hash} style={styles.proofRow}>
            {proof.network === "fork" ? (
              <ProofLink href={null} label={txProofLabel(proof)} reference={proof.hash} note={S.verify.fork} />
            ) : (
              <ProofLink href={txProofHref(proof)} label={txProofLabel(proof)} reference={proof.hash} />
            )}
            <ProofNote>{proof.detail}</ProofNote>
          </Reveal>
        ))}
      </View>
      <Reveal>
        <ProofNote>{S.verify.contracts}</ProofNote>
      </Reveal>
      <View style={styles.proofs}>
        {CONTRACT_PROOFS.map((proof) =>
          proof.address === null ? null : (
            <Reveal key={proof.key} style={styles.proofRow}>
              <ProofLink href={contractProofHref(proof)} label={proof.label} reference={proof.address} />
            </Reveal>
          ),
        )}
      </View>
    </View>
  );
}

/**
 * `/demo` — web DemoPage.tsx at 402 px: the sticky demo bar, the hero with the video, five sections (the ritual, the
 * reel, the Room and Sensei, the depth cards, the receipts) and the close, each block rising in as web's `Reveal`.
 */
export function DemoScreen() {
  const { color } = useTheme();
  return (
    <ExplorePage title={DEMO.title} scroll={false}>
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.page} stickyHeaderIndices={[0]}>
        <DemoBar />
        <DemoHero />

        <View style={styles.section}>
          <Reveal>
            <Kicker icon={Smartphone}>{S.tap.kicker}</Kicker>
            <Headline level="h2" lead={S.tap.headline} serif={S.tap.headlineSerif} />
            <Body>{S.tap.body}</Body>
            <InlineLink label={S.tap.link} icon={ArrowRight} onPress={() => go("/markets")} />
          </Reveal>
          <Reveal>
            <Frame shot="markets" alt={DEMO.frame.markets} />
          </Reveal>
        </View>

        <View style={styles.section}>
          <Reveal>
            <Kicker icon={Zap}>{S.reel.kicker}</Kicker>
            <Headline level="h2" lead={S.reel.headline} serif={S.reel.headlineSerif} />
            <Body>{S.reel.body}</Body>
            <InlineLink label={S.reel.link} icon={ArrowRight} onPress={() => go("/reels")} />
          </Reveal>
          <Reveal>
            <Frame shot="reel" alt={DEMO.frame.reel} phone />
          </Reveal>
        </View>

        <View style={styles.section}>
          <Reveal>
            <Kicker icon={MessageSquare}>{S.social.kicker}</Kicker>
            <Headline level="h2" lead={S.social.headline} serif={S.social.headlineSerif} />
            <Body>{S.social.body}</Body>
            <View style={styles.links}>
              <InlineLink flush label={S.social.room} icon={ArrowRight} onPress={() => go("/markets")} />
              <InlineLink flush label={S.social.sensei} icon={ArrowRight} onPress={() => go("/sensei")} />
            </View>
          </Reveal>
          <Reveal>
            <Frame shot="sensei" alt={DEMO.frame.sensei} />
          </Reveal>
        </View>

        <View style={styles.section}>
          <Reveal>
            <Kicker icon={TrendingUp}>{S.depth.kicker}</Kicker>
            <Headline level="h2" lead={S.depth.headline} serif={S.depth.headlineSerif} />
          </Reveal>
          <DepthCards />
        </View>

        <Verify />

        <View style={styles.close}>
          <Reveal>
            <Headline level="close" lead={DEMO.close.headline} serif={DEMO.close.headlineSerif} />
            <View style={styles.closeCtas}>
              <Ctas big />
            </View>
            <Text style={[styles.footer, { color: color.inkDisabled }]}>{DEMO.close.footer}</Text>
          </Reveal>
        </View>
      </ScrollView>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: CHROME.dockClearance },
  section: { gap: 48, paddingVertical: 80, paddingHorizontal: 24 },
  links: { gap: 8, marginTop: 24 },
  cards: { gap: 16, marginTop: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, overflow: "hidden" },
  cardTitle: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 28.8, marginTop: 16 },
  cardBody: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 21.94, marginTop: 8 },
  cardProof: { marginTop: 16 },
  proofs: { gap: 14, marginTop: 32 },
  proofRow: { paddingVertical: 4 },
  close: { paddingVertical: 96, paddingHorizontal: 24 },
  closeCtas: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 32 },
  footer: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.275, marginTop: 40, textAlign: "center" },
});
