import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { FEES, MECHANICS, QUOTE_FIELDS, STEPS } from "@/features/how-it-works/content";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { LANES, PRE_OPEN, SESSION_WORDS } from "@/features/how-it-works/sessions";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Body, CardHead, FeeTitle, Definitions, HiwCard, Rise, SectionLabel, Tag, toneInk, VStepper } from "./Blocks";
import { Formula, PayoutSplit, WeekStrip } from "./Diagrams";
import { GLYPH, LANE_GLYPHS, MECHANIC_GLYPHS, STEP_GLYPHS } from "./symbols";

const S = HOW_IT_WORKS.sections;
const EX = HOW_IT_WORKS.example;

/** web Steps.tsx: the four "Getting Started" tiles, each a numbered step in its tone, then the payout example. */
export function StepsSection() {
  const { color } = useTheme();
  return (
    <>
      <SectionLabel title={S.steps} />
      {STEPS.map((step, index) => (
        <Rise key={step.number} i={index}>
          <HiwCard>
            <View style={styles.step}>
              <Text style={[styles.num, { color: toneInk(step.tone, color), borderColor: toneInk(step.tone, color) }]}>{step.number}</Text>
              <View style={styles.stepBody}>
                <View style={styles.stepTitle}>
                  <SymbolView name={STEP_GLYPHS[step.number] ?? GLYPH.target} size={16} tintColor={toneInk(step.tone, color)} />
                  <Text style={[TYPE.title, { color: color.ink }]}>{step.title}</Text>
                </View>
                <Body>{step.description}</Body>
              </View>
            </View>
          </HiwCard>
        </Rise>
      ))}

      <SectionLabel title={S.example} />
      <Rise i={4}>
        <HiwCard tone="mint">
          <Tag tone="mint">{HOW_IT_WORKS.exampleTag}</Tag>
          <PayoutSplit />
          <View style={[styles.flow, { borderTopColor: color.hairline }]}>
            <FlowLine lead={EX.buy} chip={EX.contracts} />
            <FlowLine lead={EX.outcome} arrow />
            <FlowLine lead={EX.get} chip={EX.payout} arrow />
            <Text style={[TYPE.caption, { color: color.profit }]}>{EX.profit}</Text>
          </View>
        </HiwCard>
      </Rise>
    </>
  );
}

/** One step of web's `hiw-example-row` (You buy [100 UP @ 64¢] → … → You get [100 tUSDC]), one per line on a phone. */
function FlowLine({ lead, chip, arrow }: { lead: string; chip?: string; arrow?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.flowLine}>
      {arrow ? <SymbolView name={GLYPH.arrowRight} size={12} tintColor={color.inkMuted} /> : null}
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{lead}</Text>
      {chip ? (
        <View style={[styles.chip, { backgroundColor: color.surface2 }]}>
          <Text style={[TYPE.data, styles.chipText, { color: color.ink }]}>{chip}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** web SessionLanes.tsx: the lead, the three lanes (with the week drawn), what the clock says, calls before the bell. */
export function SessionsSection() {
  return (
    <>
      <SectionLabel title={S.sessions} glyph={GLYPH.calendarClock} />
      <Body>{HOW_IT_WORKS.sessionsLead}</Body>
      <Rise>
        <HiwCard>
          <WeekStrip />
        </HiwCard>
      </Rise>
      {LANES.map((lane, index) => (
        <Rise key={lane.name} i={index + 1}>
          <HiwCard>
            <CardHead glyph={LANE_GLYPHS[lane.name]} title={lane.name} />
            <Tag>{lane.clock}</Tag>
            <Body>{lane.body}</Body>
          </HiwCard>
        </Rise>
      ))}
      <Rise i={4}>
        <HiwCard>
          <FeeTitle>{HOW_IT_WORKS.sessionWordsTitle}</FeeTitle>
          <Body>{HOW_IT_WORKS.sessionWordsBody}</Body>
          <Definitions rows={SESSION_WORDS} />
        </HiwCard>
      </Rise>
      <Rise i={5}>
        <HiwCard tone="mint">
          <FeeTitle>{PRE_OPEN.title}</FeeTitle>
          <Body>{PRE_OPEN.body}</Body>
          <VStepper tone="mint" steps={PRE_OPEN.points.map((point) => ({ key: point, body: point }))} />
        </HiwCard>
      </Rise>
    </>
  );
}

/** web Mechanics.tsx: Key Mechanics, How a Price Is Made (the formula and the quote's fields), the Fee Structure. */
export function MechanicsSection() {
  const { color } = useTheme();
  const ink = { color: color.ink, fontFamily: FONT.bodyStrong };
  return (
    <>
      <SectionLabel title={S.mechanics} />
      {MECHANICS.map((item, index) => (
        <Rise key={item.title} i={index}>
          <HiwCard>
            <CardHead glyph={MECHANIC_GLYPHS[item.title]} title={item.title} />
            <Body>{item.description}</Body>
          </HiwCard>
        </Rise>
      ))}

      <SectionLabel title={S.pricing} />
      <Rise>
        <HiwCard>
          <Body>
            Nothing here is modelled. The price of <Text style={ink}>UP</Text> is the best offer resting on the book, in
            cents — which is also the market&apos;s probability. <Text style={ink}>DOWN</Text> is the same book seen from the
            other side. A UP buy and a DOWN buy that add up to one dollar can match into a freshly minted pair, so a quote
            exists from the first second without a market maker.
          </Body>
          <Formula />
          <Definitions rows={QUOTE_FIELDS} />
          <Body dim>
            Every quote is read off the live book for your exact stake, so the cost you see is the cost the book would
            charge now. Orders go in immediate-or-cancel at a protective limit: what crosses fills, the rest is cancelled,
            and the escrow locked at that limit is the most a fill can ever cost.
          </Body>
        </HiwCard>
      </Rise>

      <SectionLabel title={S.fees} />
      <Rise>
        <HiwCard>
          {FEES.map((fee, index) => (
            <View key={fee.title} style={[styles.fee, index > 0 && { borderTopColor: color.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <FeeTitle>{fee.title}</FeeTitle>
              <Body>{fee.body}</Body>
            </View>
          ))}
        </HiwCard>
      </Rise>
    </>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 14 },
  num: {
    fontFamily: FONT.dataStrong,
    fontSize: 18,
    width: 36,
    height: 36,
    lineHeight: 34,
    textAlign: "center",
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
  },
  stepBody: { flex: 1, gap: 6 },
  stepTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  flow: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  flowLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 12.5 },
  fee: { gap: 6, paddingTop: 12 },
});
