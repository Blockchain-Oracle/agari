import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PITCH } from "@/features/pitch/copy";
import { marketsEnv } from "~/lib/env";
import { FONT, TYPE } from "~/theme";
import { CountUp, H1, Kicker, Lead, Mono, PAPER, Pills, Rise, Sheet, SpecPanel } from "./Folio";
import { FrozenPhone, PhoneMock, XBetCard } from "./Mocks";
import type { Page } from "./Pager";

/**
 * Slides 01–08 — web pitch/slides-a.tsx, slide for slide, in web's words (`PITCH`). The phone stacks what web sets
 * side by side: the headline and lead first, the panel or the mock under them.
 *
 * Only the lines that describe where Agari runs are the phone's own: web's deck says "no native build", which the
 * native app itself cannot truthfully repeat (`NATIVE` below).
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

function Cells({ cells, note, i = 3 }: { cells: readonly (readonly [string, string, string?])[]; note?: string; i?: number }) {
  return (
    <Rise i={i}>
      <View style={styles.cells}>
        {cells.map(([name, label, state]) => (
          <View key={name} style={[styles.cell, { borderColor: PAPER.creamHairline }]}>
            <Text style={[TYPE.bodyStrong, { color: PAPER.ink }]}>{name}</Text>
            {state ? <Mono tone={state === "LIVE" ? "live" : "verm"}>{state}</Mono> : null}
            <Text style={[TYPE.caption, { color: PAPER.inkSecondary }]}>{label}</Text>
          </View>
        ))}
        {note ? <Mono tone="live">{note}</Mono> : null}
      </View>
    </Rise>
  );
}

export const SLIDES_A: Page[] = [
  {
    id: "glance",
    section: C.section,
    render: () => (
      <Sheet>
        <H1 lines={[C.h1a, C.h1b]} emph={C.emph} />
        <Lead>
          {C.lead} <Text style={{ color: PAPER.ink, fontFamily: FONT.bodyStrong }}>{C.leadStrong}</Text>
        </Lead>
        <Pills items={[[C.pills[0], "live"], [NATIVE.pill, "ink"], [C.pills[2], "verm"]]} />
        <SpecPanel
          i={4}
          title={C.glanceTitle}
          badge={C.glanceBadge}
          rows={[
            C.rows.betOn,
            [C.rows.where[0], NATIVE.where],
            [C.rows.engine[0], C.rows.engine[1], true],
            [C.rows.custody[0], C.rows.custody[1], true],
            C.rows.onboarding,
            [C.rows.builtOn, C.rows.chain],
          ]}
        />
      </Sheet>
    ),
  },
  {
    id: "engine",
    section: E.section,
    render: () => (
      <Sheet paper={2}>
        <Kicker>{E.kicker}</Kicker>
        <H1 lines={[E.h1a, E.h1b]} emph={E.emph} />
        <Lead>{E.lead}</Lead>
        <SpecPanel
          title={E.panelTitle}
          badge={E.panelBadge}
          rows={[E.rows[0], [E.rows[1][0], E.rows[1][1], true], E.rows[2], [E.rows[3][0], E.rows[3][1], true], E.rows[4], E.rows[5]]}
        />
      </Sheet>
    ),
  },
  {
    id: "gap",
    section: G.section,
    render: () => (
      <Sheet>
        <Kicker>{G.kicker}</Kicker>
        <H1 lines={[G.h1a, G.h1b]} emph={G.emph} />
        <Lead>{G.lead}</Lead>
        <FrozenPhone />
      </Sheet>
    ),
  },
  {
    id: "edge",
    section: D.section,
    render: () => (
      <Sheet paper={2}>
        <Kicker>{D.kicker}</Kicker>
        <H1 lines={[D.h1a]} emph={D.emph} />
        <Lead>{D.lead}</Lead>
        <Cells cells={D.cells} note={D.live} />
      </Sheet>
    ),
  },
  {
    id: "x",
    section: X.section,
    render: () => (
      <Sheet>
        <Kicker>{X.kicker}</Kicker>
        <H1 lines={[X.h1a, X.h1b]} emph={X.emph} />
        <Lead>{X.lead}</Lead>
        <Pills items={[[X.pills[0], "verm"], [X.pills[1], "ink"], [X.pills[2], "ink"]]} />
        <XBetCard />
      </Sheet>
    ),
  },
  {
    id: "proof",
    section: P.section,
    render: () => (
      <Sheet paper={2}>
        <Kicker>{P.kicker}</Kicker>
        <H1 lines={[P.h1a, P.h1b]} emph={P.emph} />
        <Lead>{P.lead}</Lead>
        <Rise i={3}>
          <View style={styles.proofGrid}>
            <View style={[styles.proofCell, { borderColor: PAPER.creamHairline }]}>
              <Mono tone="faint">{P.leftLabel}</Mono>
              <Text style={[styles.figure, { color: PAPER.ink }]}>
                <CountUp to={137} /> <Text style={[TYPE.caption, { color: PAPER.inkSecondary }]}>on devnet</Text>
              </Text>
              <Text style={[TYPE.caption, { color: PAPER.inkSecondary }]}>{P.leftSub}</Text>
            </View>
            <View style={[styles.proofCell, { borderColor: PAPER.creamHairline }]}>
              <Mono tone="faint">{P.rightLabel}</Mono>
              <Text style={[styles.figure, { color: PAPER.profit }]}>0</Text>
              <Text style={[TYPE.caption, { color: PAPER.inkSecondary }]}>{P.rightSub}</Text>
            </View>
          </View>
        </Rise>
        <SpecPanel i={4} title={P.rowsTitle} badge={P.rowsBadge} rows={[P.rows[0], [P.rows[1][0], P.rows[1][1], true], P.rows[2], [P.rows[3][0], P.rows[3][1], true]]} />
        <Mono tone="mute">
          {P.provenance} {shortAddr(EVENTS_PROGRAM)} ·{" "}
          <Link href="/status" style={{ color: PAPER.accent }}>
            {P.status}
          </Link>
        </Mono>
      </Sheet>
    ),
  },
  {
    id: "onboard",
    section: O.section,
    render: () => (
      <Sheet>
        <Kicker>{O.kicker}</Kicker>
        <H1 lines={[O.h1a, O.h1b]} emph={O.emph} />
        <Lead>{O.lead}</Lead>
        <Cells cells={O.cells.map(([name, label, state]) => [name, label, state] as const)} />
      </Sheet>
    ),
  },
  {
    id: "mobile",
    section: M.section,
    render: () => (
      <Sheet paper={2}>
        <Kicker>{M.kicker}</Kicker>
        <H1 lines={[M.h1a]} emph={M.emph} />
        <Lead>{NATIVE.mobileLead}</Lead>
        <Pills items={[[M.pills[0], "verm"], [M.pills[1], "ink"], [NATIVE.pill, "live"]]} />
        <PhoneMock i={4} />
      </Sheet>
    ),
  },
];

const styles = StyleSheet.create({
  cells: { gap: 8 },
  cell: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  proofGrid: { gap: 10 },
  proofCell: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 6 },
  figure: { ...TYPE.dataHero },
});
