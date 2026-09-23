import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { Button, Hero, Screen } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { Body, HiwCard, Rise } from "./Blocks";
import { FaqSection } from "./Faq";
import { MechanicsSection, SessionsSection, StepsSection } from "./SectionsA";
import { AsidesSection, BasketsDeskSection, SettlementSection } from "./SectionsB";

/**
 * `/how-it-works` — web HowItWorksPage.tsx, section for section and in its order: hero, getting started, the payout
 * example, sessions and lanes, key mechanics, pricing, fees, settlement, halts and voids, the architecture, baskets
 * and the desk, the FAQ and the call to action. The words are web's own modules; the diagrams are drawn natively.
 */
export function HowItWorksScreen() {
  const { color } = useTheme();
  const router = useRouter();
  return (
    <Screen title={HOW_IT_WORKS.title}>
      <Hero title={HOW_IT_WORKS.title} lead={HOW_IT_WORKS.lead} />
      <StepsSection />
      <SessionsSection />
      <MechanicsSection />
      <SettlementSection />
      <AsidesSection />
      <BasketsDeskSection />
      <FaqSection />
      <Rise>
        <HiwCard tone="mint">
          <Text style={[TYPE.headline, styles.ctaTitle, { color: color.ink }]}>{HOW_IT_WORKS.cta.title}</Text>
          <Body>{HOW_IT_WORKS.cta.body}</Body>
          <Button label={HOW_IT_WORKS.cta.action} onPress={() => router.navigate("/markets")} size="lg" />
        </HiwCard>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ctaTitle: { fontSize: 24 },
});
