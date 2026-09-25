import { ArrowRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { FEES, MECHANICS, QUOTE_FIELDS, STEPS } from "@/features/how-it-works/content";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { LANES, PRE_OPEN, SESSION_WORDS } from "@/features/how-it-works/sessions";
import { FONT, useTheme } from "~/theme";
import { hiwTokens } from "~/theme/web/explore/how-it-works";
import { Body, Card, CardHead, FeeTitle, HIW_FONT, Label, Params, Rise, Section, Steps, StepTitle, Tag } from "./Blocks";
import { LABEL_ICONS, LANE_ICONS, MECHANIC_ICONS, STEP_ICONS } from "./symbols";

const W = HOW_IT_WORKS;

/** The payout example card (web Steps.tsx): three figures, then the buy → outcome → get row. */
function Example() {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  const figures = [
    { value: "64¢", label: W.example.up, ink: t.mint },
    { value: "36¢", label: W.example.down, ink: color.loss },
    { value: "1.00", label: W.example.max, ink: color.ink },
  ];
  const arrow = <ArrowRight size={16} color={color.inkDisabled} />;
  const chip = (text: string) => (
    <View style={[styles.chip, { backgroundColor: t.mintWash }]}>
      <Text style={[styles.chipText, { color: t.mint }]}>{text}</Text>
    </View>
  );
  return (
    <Rise index={4} style={styles.exampleGap}>
      <Card tone="mint">
        <Label title={W.sections.example} />
        <Tag>{W.exampleTag}</Tag>
        <View style={styles.figures}>
          {figures.map((f) => (
            <View key={f.label} style={styles.figure}>
              <Text style={[styles.figureValue, { color: f.ink }]}>{f.value}</Text>
              <Text style={[styles.figureLabel, { color: color.inkMuted }]}>{f.label}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.exampleRow, { borderTopColor: t.line }]}>
          <Text style={[styles.rowText, { color: color.inkSecondary }]}>{W.example.buy}</Text>
          {chip(W.example.contracts)}
          {arrow}
          <Text style={[styles.rowText, { color: color.inkSecondary }]}>{W.example.outcome}</Text>
          {arrow}
          <Text style={[styles.rowText, { color: color.inkSecondary }]}>{W.example.get}</Text>
          {chip(W.example.payout)}
          <Text style={[styles.note, { color: color.inkDisabled }]}>{W.example.profit}</Text>
        </View>
      </Card>
    </Rise>
  );
}

/** web Steps.tsx: "Getting Started" — four numbered tiles in their mint/blue tones — and the payout example. */
export function StepsSection() {
  const { name } = useTheme();
  const t = hiwTokens(name);
  return (
    <>
      <Section>
        <Label title={W.sections.steps} />
        <View style={styles.grid}>
          {STEPS.map((step, index) => (
            <Rise key={step.number} index={index}>
              <Card>
                <View style={styles.step}>
                  <View style={[styles.num, { backgroundColor: step.tone === "mint" ? t.mintWash : t.blueWash }]}>
                    <Text style={[styles.numText, { color: step.tone === "mint" ? t.mint : t.blue }]}>{step.number}</Text>
                  </View>
                  <View style={styles.flex}>
                    <StepTitle icon={STEP_ICONS[step.number] ?? ArrowRight} tone={step.tone}>
                      {step.title}
                    </StepTitle>
                    <Body>{step.description}</Body>
                  </View>
                </View>
              </Card>
            </Rise>
          ))}
        </View>
      </Section>
      <Example />
    </>
  );
}

/** web SessionLanes.tsx: the three lanes, what the clock says, and calls before the bell. */
export function SessionsSection() {
  return (
    <Section>
      <Label title={W.sections.sessions} icon={LABEL_ICONS.sessions} />
      <Body style={styles.leadGap}>{W.sessionsLead}</Body>
      <View style={[styles.grid, styles.archGap]}>
        {LANES.map((lane, index) => (
          <Rise key={lane.name} index={index} baseMs={250}>
            <Card>
              <CardHead icon={LANE_ICONS[lane.name] ?? ArrowRight} title={lane.name} />
              <Tag>{lane.clock}</Tag>
              <Body>{lane.body}</Body>
            </Card>
          </Rise>
        ))}
      </View>
      <Rise index={3} baseMs={250}>
        <Card>
          <FeeTitle>{W.sessionWordsTitle}</FeeTitle>
          <Body style={styles.bodyGap}>{W.sessionWordsBody}</Body>
          <Params rows={SESSION_WORDS} />
        </Card>
      </Rise>
      <Rise index={4} baseMs={250} style={styles.archTop}>
        <Card tone="mint">
          <FeeTitle>{PRE_OPEN.title}</FeeTitle>
          <Body style={styles.bodyGap}>{PRE_OPEN.body}</Body>
          <Steps items={PRE_OPEN.points.map((point, index) => ({ key: point, num: String(index + 1), body: <Body>{point}</Body> }))} />
        </Card>
      </Rise>
    </Section>
  );
}

/** web Mechanics.tsx: "Key Mechanics", "How a Price Is Made" and "Fee Structure". */
export function MechanicsSection() {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  const ink = { color: color.ink };
  return (
    <>
      <Section>
        <Label title={W.sections.mechanics} />
        <View style={styles.grid}>
          {MECHANICS.map((item, index) => (
            <Rise key={item.title} index={index} baseMs={400}>
              <Card>
                <CardHead icon={MECHANIC_ICONS[item.title] ?? ArrowRight} title={item.title} />
                <Body>{item.description}</Body>
              </Card>
            </Rise>
          ))}
        </View>
      </Section>

      <Section>
        <Label title={W.sections.pricing} />
        <Rise baseMs={450}>
          <Card>
            <Body style={styles.bodyGap}>
              Nothing here is modelled. The price of <Text style={ink}>UP</Text> is the best offer resting on the book, in cents — which is
              also the market&apos;s probability. <Text style={ink}>DOWN</Text> is the same book seen from the other side. A UP buy and a DOWN
              buy that add up to one dollar can match into a freshly minted pair, so a quote exists from the first second without a market
              maker.
            </Body>
            <View style={[styles.formula, { backgroundColor: t.formula, borderColor: t.line }]} accessibilityRole="image" accessibilityLabel={W.sections.pricing}>
              {[W.formula.identity, W.formula.cost, W.formula.payout].map((line) => (
                <Text key={line} style={[styles.formulaText, { color: color.accent }]} numberOfLines={1}>
                  {line}
                </Text>
              ))}
            </View>
            <Params rows={QUOTE_FIELDS} />
            <Body dim style={styles.foot}>
              Every quote is read off the live book for your exact stake, so the cost you see is the cost the book would charge now. Orders go
              in immediate-or-cancel at a protective limit: what crosses fills, the rest is cancelled, and the escrow locked at that limit is
              the most a fill can ever cost.
            </Body>
          </Card>
        </Rise>
      </Section>

      <Section>
        <Label title={W.sections.fees} />
        <Rise baseMs={500}>
          <Card>
            {FEES.map((fee, index) => (
              <View key={fee.title} style={index > 0 ? [styles.feeNext, { borderTopColor: t.line }] : null}>
                <FeeTitle>{fee.title}</FeeTitle>
                <Body>{fee.body}</Body>
              </View>
            ))}
          </Card>
        </Rise>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  num: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: HIW_FONT.black, fontSize: 14, lineHeight: 22.4 },
  exampleGap: { marginBottom: 80 },
  figures: { flexDirection: "row", gap: 12, marginBottom: 24 },
  figure: { flex: 1, alignItems: "center" },
  figureValue: { fontFamily: HIW_FONT.monoHeavy, fontSize: 20, lineHeight: 32 },
  figureLabel: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2, marginTop: 4, textAlign: "center" },
  exampleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingTop: 24, borderTopWidth: 1 },
  rowText: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  chip: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12 },
  chipText: { fontFamily: HIW_FONT.monoBold, fontSize: 14, lineHeight: 22.4 },
  note: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  leadGap: { marginBottom: 16 },
  bodyGap: { marginBottom: 24 },
  archGap: { marginBottom: 16 },
  archTop: { marginTop: 16 },
  formula: { gap: 6, marginBottom: 24, borderWidth: 1, borderRadius: 12, padding: 16 },
  formulaText: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
  foot: { marginTop: 24 },
  feeNext: { marginTop: 24, paddingTop: 24, borderTopWidth: 1 },
});
