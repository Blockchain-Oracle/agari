import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { PITCH } from "@/features/pitch/copy";
import { marketsEnv } from "~/lib/env";
import { FONT } from "~/theme";
import { PITCH_PAPER as PP } from "~/theme/web/explore/pitch";
import type { Slide } from "./Deck";
import { CountUp, H1, Ink, Kicker, Lead, Mono, Pills, Rise } from "./Folio";
import { LogoCard, SolanaMark } from "./Marks";
import { FrozenPhone, PhoneMock, XBetCard } from "./Mocks";
import { Glance, GlanceVal, SpecPanel } from "./Panels";

/**
 * Slides 01–08 — web pitch/slides-a.tsx as pitch-slides.css stacks it under 900 px: the words first, the panel or
 * the mock under them, the cell strips as one column.
 *
 * Only the lines that say where Agari runs are the app's own: web's deck says "no native build", which the native app
 * itself cannot truthfully repeat (`NATIVE`).
 */
const C = PITCH.cover;
const E = PITCH.engine;
const G = PITCH.gap;
const D = PITCH.edge;
const X = PITCH.x;
const P = PITCH.proof;
const O = PITCH.onboard;
const M = PITCH.mobile;

export const NATIVE = {
  where: "Web · PWA · native app",
  pill: "Native app · iOS + Android",
  mobileLead:
    "People spend their time in apps, so Agari is one: this native app on iOS and Android, with the reel phone-first and the ticket, the Window and the wallet drawn natively — and the web app still installs from the browser and runs full-screen from the home screen.",
} as const;

const shortAddr = (address: string) => address.slice(0, 10);
const EVENTS_PROGRAM = marketsEnv.eventsProgramId ?? "not deployed";

/** web `.pitch-cells` under 900 px: one bordered card, the cells stacked with hairlines between. */
function Cells({ children, note, i = 3 }: { children: React.ReactNode; note?: string; i?: number }) {
  return (
    <Rise i={i} style={styles.cellsWrap}>
      <View style={styles.cells}>{children}</View>
      {note ? (
        <Mono tone="live" size={11} style={styles.cellsNote}>
          {note}
        </Mono>
      ) : null}
    </Rise>
  );
}

export const SLIDES_A: Slide[] = [
  {
    id: "glance",
    section: C.section,
    render: () => (
      <View style={styles.row}>
        <View>
          <H1 size="cover" lines={[C.h1a]} inline={C.h1b} emph={C.emph} i={0} />
          <Lead i={1}>
            {C.lead} <Ink>{C.leadStrong}</Ink>
          </Lead>
          <Pills i={2} items={[[C.pills[0], "live"], [NATIVE.pill, "ink"], [C.pills[2], "verm"]]} />
        </View>
        <Glance
          i={3}
          title={C.glanceTitle}
          badge={C.glanceBadge}
          rows={[
            C.rows.betOn,
            [C.rows.where[0], NATIVE.where],
            [C.rows.engine[0], C.rows.engine[1], true],
            [C.rows.custody[0], C.rows.custody[1], true],
            C.rows.onboarding,
            [
              C.rows.builtOn,
              <View key="bo" style={styles.marks}>
                <SolanaMark s={20} />
                <GlanceVal>{C.rows.chain}</GlanceVal>
              </View>,
            ],
          ]}
        />
      </View>
    ),
  },
  {
    id: "engine",
    section: E.section,
    paper: 2,
    render: () => (
      <View style={styles.row}>
        <View>
          <Kicker>{E.kicker}</Kicker>
          <H1 size="dense" lines={[E.h1a]} inline={E.h1b} emph={E.emph} />
          <Lead>{E.lead}</Lead>
        </View>
        <SpecPanel i={3} title={E.panelTitle} badge={E.panelBadge} rows={[E.rows[0], [E.rows[1][0], E.rows[1][1], true], E.rows[2], [E.rows[3][0], E.rows[3][1], true], E.rows[4], E.rows[5]]} />
      </View>
    ),
  },
  {
    id: "gap",
    section: G.section,
    render: () => (
      <View style={styles.row}>
        <View>
          <Kicker>{G.kicker}</Kicker>
          <H1 size="art" lines={[G.h1a]} inline={G.h1b} emph={G.emph} />
          <Lead>{G.lead}</Lead>
        </View>
        <FrozenPhone tilt={4} i={3} />
      </View>
    ),
  },
  {
    id: "edge",
    section: D.section,
    paper: 2,
    render: () => (
      <View>
        <Kicker>{D.kicker}</Kicker>
        <H1 size="art" lines={[D.h1a]} emph={D.emph} />
        <Lead>{D.lead}</Lead>
        <Cells note={D.live}>
          {D.cells.map(([name, label], index) => (
            <View key={name} style={[styles.cell, index > 0 && styles.cellRule]}>
              <Text style={styles.cellName}>{name}</Text>
              <Text style={styles.cellLabel}>{label}</Text>
            </View>
          ))}
        </Cells>
      </View>
    ),
  },
  {
    id: "x",
    section: X.section,
    render: () => (
      <View style={styles.row}>
        <View>
          <Kicker>{X.kicker}</Kicker>
          <H1 size="art" lines={[X.h1a]} inline={X.h1b} emph={X.emph} />
          <Lead>{X.lead}</Lead>
          <Pills items={[[X.pills[0], "verm"], [X.pills[1], "ink"], [X.pills[2], "ink"]]} />
        </View>
        <XBetCard tilt={-1.5} i={4} />
      </View>
    ),
  },
  {
    id: "proof",
    section: P.section,
    paper: 2,
    render: () => (
      <View>
        <Kicker>{P.kicker}</Kicker>
        <H1 size="proof" lines={[P.h1a]} inline={P.h1b} emph={P.emph} />
        <Lead mute>{P.lead}</Lead>
        <View style={styles.proofGrid}>
          <Rise i={3}>
            <Mono tone="faint" size={11}>
              {P.leftLabel}
            </Mono>
            <Text style={styles.proofFigure}>
              <CountUp to={137} /> <Text style={styles.proofUnit}>on devnet</Text>
            </Text>
            <Text style={styles.proofSub}>{P.leftSub}</Text>
            <Svg width="100%" height={2} style={styles.proofDash}>
              <Line x1={0} y1={1} x2="100%" y2={1} stroke={PP.verm} strokeWidth={2} strokeDasharray="6 6" />
            </Svg>
          </Rise>
          <Rise i={4}>
            <Mono tone="faint" size={11}>
              {P.rightLabel}
            </Mono>
            <Text style={[styles.proofFigure, styles.proofZero]}>0</Text>
            <Text style={styles.proofSub}>{P.rightSub}</Text>
          </Rise>
        </View>
        <View style={styles.proofSpec}>
          <SpecPanel i={5} title={P.rowsTitle} badge={P.rowsBadge} rows={[P.rows[0], [P.rows[1][0], P.rows[1][1], true], P.rows[2], [P.rows[3][0], P.rows[3][1], true]]} />
        </View>
        <Rise i={6} style={styles.provenance}>
          <Mono tone="mute" size={11}>
            {P.provenance} {shortAddr(EVENTS_PROGRAM)}
          </Mono>
          <Text style={styles.faint}>·</Text>
          <Text style={styles.linkVerm} onPress={() => router.push("/status")} accessibilityRole="link">
            {P.status}
          </Text>
        </Rise>
      </View>
    ),
  },
  {
    id: "onboard",
    section: O.section,
    render: () => (
      <View>
        <Kicker>{O.kicker}</Kicker>
        <H1 size="art" lines={[O.h1a]} inline={O.h1b} emph={O.emph} />
        <Lead>{O.lead}</Lead>
        <Cells>
          {O.cells.map(([name, label, state], index) => (
            <View key={name} style={[styles.cell3, index > 0 && styles.cellRule, state !== "LIVE" && styles.cellSoft]}>
              <View style={styles.cellHead}>
                {index === 2 ? <LogoCard s={26} /> : null}
                <Text style={styles.cellName}>{name}</Text>
              </View>
              <View style={styles.cellSub}>
                <Mono tone={state === "LIVE" ? "live" : "verm"} size={10}>
                  {state}
                </Mono>
                <Mono tone="mute" size={10}>
                  {label}
                </Mono>
              </View>
            </View>
          ))}
        </Cells>
      </View>
    ),
  },
  {
    id: "mobile",
    section: M.section,
    paper: 2,
    render: () => (
      <View style={styles.row}>
        <View>
          <Kicker>{M.kicker}</Kicker>
          <H1 size="art" lines={[M.h1a]} emph={M.emph} />
          <Lead>{NATIVE.mobileLead}</Lead>
          <Pills items={[[M.pills[0], "verm"], [M.pills[1], "ink"], [NATIVE.pill, "live"]]} />
        </View>
        <PhoneMock tilt={-1.5} i={4} />
      </View>
    ),
  },
];

const styles = StyleSheet.create({
  // .pitch-row under 900 px: a column, 28 px apart, the art centred.
  row: { gap: 28 },
  marks: { flexDirection: "row", alignItems: "center", gap: 12 },
  cellsWrap: { marginTop: 36 },
  cells: { borderWidth: 1, borderColor: PP.hair, borderRadius: 12, overflow: "hidden", backgroundColor: PP.card },
  cell: { paddingVertical: 18, paddingHorizontal: 20 },
  cell3: { paddingVertical: 18, paddingHorizontal: 22 },
  cellRule: { borderTopWidth: 1, borderTopColor: PP.hair },
  cellSoft: { backgroundColor: PP.soft },
  cellHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  cellName: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 22, letterSpacing: -0.36, color: PP.ink },
  cellLabel: { marginTop: 6, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18, color: PP.body },
  cellSub: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cellsNote: { marginTop: 12 },
  proofGrid: { marginTop: 32, gap: 20 },
  proofDash: { marginTop: 20 },
  proofFigure: { marginTop: 8, fontFamily: FONT.headingHeavy, fontSize: 28.8, lineHeight: 36, letterSpacing: -0.58, color: PP.ink },
  proofZero: { color: PP.green, alignSelf: "flex-start" },
  proofUnit: { fontSize: 14.4, color: PP.mute },
  proofSub: { marginTop: 8, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18, color: PP.mute },
  proofSpec: { marginTop: 28 },
  provenance: { marginTop: 32, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  faint: { color: PP.faint, fontFamily: FONT.dataRegular, fontSize: 11 },
  linkVerm: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, color: PP.verm },
});
