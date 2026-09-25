import { ArrowRight } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { ARCHITECTURE, BASKETS, DESK_NEVER, DESK_PROGRAM_ENFORCES, DESK_STEPS, SETTLEMENT_STEPS } from "@/features/how-it-works/content";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { ASIDES } from "@/features/how-it-works/sessions";
import { useTheme } from "~/theme";
import { hiwTokens } from "~/theme/web/explore/how-it-works";
import { Body, Card, CardHead, FeeTitle, Label, Params, Rise, Section, StepLabel, Steps, Tag } from "./Blocks";
import { ARCH_ICONS, ASIDE_ICONS, LABEL_ICONS } from "./symbols";

const W = HOW_IT_WORKS;

/** web Settlement.tsx: the settlement process steps and the three blue architecture cards. */
export function SettlementSection() {
  return (
    <>
      <Section>
        <Label title={W.sections.settlement} />
        <Rise baseMs={550}>
          <Card>
            <Steps
              items={SETTLEMENT_STEPS.map((item) => ({
                key: item.step,
                num: item.step,
                body: (
                  <>
                    <StepLabel>{item.label}</StepLabel>
                    <Body>{item.desc}</Body>
                  </>
                ),
              }))}
            />
          </Card>
        </Rise>
      </Section>

      <Section>
        <Label title={W.sections.architecture} icon={LABEL_ICONS.architecture} blue />
        <View style={styles.grid}>
          {ARCHITECTURE.map((card, index) => (
            <Rise key={card.title} index={index} baseMs={500}>
              <Card tone="blue">
                <CardHead icon={ARCH_ICONS[card.title] ?? ArrowRight} title={card.title} blue />
                <Body>{card.body}</Body>
              </Card>
            </Rise>
          ))}
        </View>
      </Section>
    </>
  );
}

/** web SessionLanes.tsx `Asides`: halts, voids and your money in one card, ruled between. */
export function AsidesSection() {
  const { name } = useTheme();
  const t = hiwTokens(name);
  return (
    <Section>
      <Label title={W.sections.asides} />
      <Rise baseMs={600}>
        <Card>
          {ASIDES.map((aside, index) => (
            <View key={aside.title} style={index > 0 ? [styles.next, { borderTopColor: t.line }] : null}>
              <CardHead icon={ASIDE_ICONS[aside.title] ?? ArrowRight} title={aside.title} fee />
              <Body>{aside.body}</Body>
            </View>
          ))}
        </Card>
      </Rise>
    </Section>
  );
}

/** web BasketsAndDesk.tsx: "Baskets" as a definition list, then "How the Desk Decides" step by step. */
export function BasketsDeskSection() {
  return (
    <>
      <Section>
        <Label title={W.sections.baskets} icon={LABEL_ICONS.baskets} />
        <Rise baseMs={650}>
          <Card>
            <Body style={styles.bodyGap}>{BASKETS.body}</Body>
            <Params rows={BASKETS.uses} />
          </Card>
        </Rise>
      </Section>

      <Section>
        <Label title={W.sections.desk} icon={LABEL_ICONS.desk} blue />
        <Body style={styles.leadGap}>{W.deskLead}</Body>
        <Rise index={1} baseMs={650}>
          <Card tone="blue">
            <Steps
              items={DESK_STEPS.map((item) => ({
                key: item.step,
                num: item.step,
                body: (
                  <>
                    <StepLabel>{item.label}</StepLabel>
                    <Tag style={styles.kindTag}>{W.deskKinds[item.kind]}</Tag>
                    <Body>{item.desc}</Body>
                  </>
                ),
              }))}
            />
          </Card>
        </Rise>
        <View style={[styles.grid, styles.top]}>
          <Rise index={2} baseMs={650}>
            <Card tone="blue">
              <FeeTitle>{W.deskEnforcesTitle}</FeeTitle>
              <Params rows={DESK_PROGRAM_ENFORCES} />
            </Card>
          </Rise>
          <Rise index={3} baseMs={650}>
            <Card>
              <FeeTitle>{W.deskNeverTitle}</FeeTitle>
              <Params rows={DESK_NEVER} />
            </Card>
          </Rise>
        </View>
        <Tag style={styles.networkTag}>{W.deskNetwork}</Tag>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 16 },
  top: { marginTop: 16 },
  next: { marginTop: 24, paddingTop: 24, borderTopWidth: 1 },
  bodyGap: { marginBottom: 24 },
  leadGap: { marginBottom: 16 },
  kindTag: { marginBottom: 8 },
  networkTag: { marginTop: 16, marginBottom: 0 },
});
