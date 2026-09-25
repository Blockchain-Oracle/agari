import { Inter_700Bold, Inter_900Black } from "@expo-google-fonts/inter";
import { JetBrainsMono_700Bold, JetBrainsMono_800ExtraBold } from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { hiwTokens } from "~/theme/web/explore/how-it-works";
import { Card, HIW_FONT, Rise } from "./Blocks";
import { FaqSection } from "./Faq";
import { MechanicsSection, SessionsSection, StepsSection } from "./SectionsA";
import { AsidesSection, BasketsDeskSection, SettlementSection } from "./SectionsB";

/**
 * `/how-it-works` — web HowItWorksPage.tsx at 402 px, section for section: the back link, the hero, getting started,
 * the payout example, sessions and lanes, key mechanics, pricing, fees, settlement, halts and voids, the architecture,
 * baskets and the desk, the FAQ and the mint call to action.
 */
export function HowItWorksScreen() {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  const [loaded, error] = useFonts({ Inter_700Bold, Inter_900Black, JetBrainsMono_700Bold, JetBrainsMono_800ExtraBold });
  const toMarkets = () => router.navigate("/markets");
  if (!loaded && !error) return <ExplorePage title={HOW_IT_WORKS.title}>{null}</ExplorePage>;

  return (
    <ExplorePage title={HOW_IT_WORKS.title} style={styles.wrap}>
      <Pressable onPress={toMarkets} accessibilityRole="link" style={styles.back} hitSlop={8}>
        <ArrowLeft size={14} color={color.inkMuted} />
        <Text style={[styles.backText, { color: color.inkMuted }]}>{HOW_IT_WORKS.back}</Text>
      </Pressable>

      <Rise style={styles.hero}>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {HOW_IT_WORKS.title}
        </Text>
        <Text style={[styles.lead, { color: color.inkSecondary }]}>{HOW_IT_WORKS.lead}</Text>
      </Rise>

      <StepsSection />
      <SessionsSection />
      <MechanicsSection />
      <SettlementSection />
      <AsidesSection />
      <BasketsDeskSection />
      <FaqSection />

      <Rise baseMs={700}>
        <Card tone="mint" style={styles.cta}>
          <Text style={[styles.ctaTitle, { color: color.ink }]}>{HOW_IT_WORKS.cta.title}</Text>
          <Text style={[styles.ctaBody, { color: color.inkSecondary }]}>{HOW_IT_WORKS.cta.body}</Text>
          <Pressable
            onPress={toMarkets}
            accessibilityRole="link"
            style={({ pressed }) => [styles.ctaButton, { backgroundColor: t.mint, boxShadow: t.ctaGlow, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Text style={[styles.ctaButtonText, { color: t.ctaInk }]}>{HOW_IT_WORKS.cta.action}</Text>
          </Pressable>
        </Card>
      </Rise>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  // .hiw-main (20 0 80) around .hiw-wrap's 24 gutter; the page frame's dock floor under the 80.
  wrap: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 80 + CHROME.dockClearance },
  back: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginBottom: 40 },
  backText: { fontFamily: HIW_FONT.bold, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase" },
  hero: { marginBottom: 64 },
  title: { fontFamily: HIW_FONT.black, fontSize: 30, lineHeight: 32, letterSpacing: -0.75, marginBottom: 16 },
  lead: { fontFamily: FONT.body, fontSize: 18, lineHeight: 29.25, maxWidth: 672 },
  cta: { padding: 48, alignItems: "center" },
  ctaTitle: { fontFamily: HIW_FONT.black, fontSize: 24, lineHeight: 32, marginBottom: 12, textAlign: "center" },
  ctaBody: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4, maxWidth: 448, marginBottom: 24, textAlign: "center" },
  ctaButton: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  ctaButtonText: { fontFamily: HIW_FONT.bold, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase" },
});
