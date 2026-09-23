import { StyleSheet, View } from "react-native";
import { ARCHITECTURE, BASKETS, DESK_NEVER, DESK_PROGRAM_ENFORCES, DESK_STEPS, SETTLEMENT_STEPS, type DeskStepKind } from "@/features/how-it-works/content";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { ASIDES } from "@/features/how-it-works/sessions";
import { useTheme } from "~/theme";
import { Body, CardHead, Definitions, FeeTitle, HiwCard, Rise, SectionLabel, Tag, VStepper, type HiwTone } from "./Blocks";
import { ARCH_GLYPHS, ASIDE_GLYPHS, GLYPH } from "./symbols";

const S = HOW_IT_WORKS.sections;

/** web Settlement.tsx: the settlement process as a stepper, then the on-chain architecture cards in blue. */
export function SettlementSection() {
  return (
    <>
      <SectionLabel title={S.settlement} />
      <Rise>
        <HiwCard>
          <VStepper steps={SETTLEMENT_STEPS.map((item) => ({ key: item.step, label: item.label, body: item.desc }))} />
        </HiwCard>
      </Rise>

      <SectionLabel title={S.architecture} glyph={GLYPH.shield} blue />
      {ARCHITECTURE.map((card, index) => (
        <Rise key={card.title} i={index}>
          <HiwCard tone="blue">
            <CardHead glyph={ARCH_GLYPHS[card.title]} title={card.title} tone="blue" />
            <Body>{card.body}</Body>
          </HiwCard>
        </Rise>
      ))}
    </>
  );
}

/** web SessionLanes.tsx `Asides`: halts, voids and your money, in one card. */
export function AsidesSection() {
  const { color } = useTheme();
  return (
    <>
      <SectionLabel title={S.asides} />
      <Rise>
        <HiwCard>
          {ASIDES.map((aside, index) => (
            <View key={aside.title} style={[styles.aside, index > 0 && { borderTopColor: color.hairline, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 }]}>
              <CardHead glyph={ASIDE_GLYPHS[aside.title]} title={aside.title} />
              <Body>{aside.body}</Body>
            </View>
          ))}
        </HiwCard>
      </Rise>
    </>
  );
}

const KIND_TONE: Record<DeskStepKind, HiwTone> = { arithmetic: "plain", ai: "mint", program: "blue" };

/** web BasketsAndDesk.tsx: Baskets as a definition list, then how the desk decides, step by step, and its two lists. */
export function BasketsDeskSection() {
  return (
    <>
      <SectionLabel title={S.baskets} glyph={GLYPH.layers} />
      <Rise>
        <HiwCard>
          <Body>{BASKETS.body}</Body>
          <Definitions rows={BASKETS.uses} />
        </HiwCard>
      </Rise>

      <SectionLabel title={S.desk} glyph={GLYPH.listChecks} blue />
      <Body>{HOW_IT_WORKS.deskLead}</Body>
      <Rise>
        <HiwCard tone="blue">
          <VStepper
            tone="blue"
            steps={DESK_STEPS.map((item) => ({
              key: item.step,
              label: item.label,
              tag: HOW_IT_WORKS.deskKinds[item.kind],
              tagTone: KIND_TONE[item.kind],
              body: item.desc,
            }))}
          />
        </HiwCard>
      </Rise>
      <Rise i={1}>
        <HiwCard tone="blue">
          <FeeTitle>{HOW_IT_WORKS.deskEnforcesTitle}</FeeTitle>
          <Definitions rows={DESK_PROGRAM_ENFORCES} />
        </HiwCard>
      </Rise>
      <Rise i={2}>
        <HiwCard>
          <FeeTitle>{HOW_IT_WORKS.deskNeverTitle}</FeeTitle>
          <Definitions rows={DESK_NEVER} />
        </HiwCard>
      </Rise>
      <Tag>{HOW_IT_WORKS.deskNetwork}</Tag>
    </>
  );
}

const styles = StyleSheet.create({
  aside: { gap: 8 },
});
