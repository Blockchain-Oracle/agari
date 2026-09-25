import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PITCH } from "@/features/pitch/copy";
import type { VenueUsage } from "@/features/pitch/useVenueUsage";
import { AgariMark } from "~/components/shell/AgariMark";
import { marketsEnv } from "~/lib/env";
import { FONT } from "~/theme";
import { PITCH_PAPER as PP } from "~/theme/web/explore/pitch";
import type { Slide } from "./Deck";
import { CountUp, H1, Kicker, Lead, Mono, Rise } from "./Folio";
import { PhoneMock } from "./Mocks";
import { PhaseCard, SpecPanel, StatCard, StatHolding } from "./Panels";

/**
 * Slides 09–15 — web pitch/slides-b.tsx, in web's words, stacked as pitch-slides.css does under 900 px. The "real
 * usage" slide reads the venue live through web's own `useVenueUsage` and says "reading" or "unreadable" rather than
 * show a number it does not have.
 */
const A = PITCH.agents;
const U = PITCH.demand;
const R = PITCH.revenue;
const W = PITCH.whySolana;
const T = PITCH.team;
const RM = PITCH.roadmap;
const CL = PITCH.close;

const shortAddr = (address: string) => address.slice(0, 10);
const EVENTS_PROGRAM = marketsEnv.eventsProgramId ?? "not deployed";
const VAULT_PROGRAM = marketsEnv.vaultProgramId ?? "not deployed";

function UsageStat({ usage, kind, i }: { usage: VenueUsage; kind: "wallets" | "calls"; i: number }) {
  const label = kind === "wallets" ? U.wallets : U.calls;
  const source = kind === "wallets" ? U.walletsSource : U.callsSource;
  if (usage.state === "reading") return <StatCard i={i} value={<StatHolding>{U.reading}</StatHolding>} label={label} source={source} />;
  if (usage.state === "unavailable") return <StatCard i={i} value={<StatHolding>{U.unavailable}</StatHolding>} label={label} source={source} />;
  const n = kind === "wallets" ? usage.rankedTraders : usage.closedCalls;
  return <StatCard i={i} value={<CountUp to={n} />} label={label} source={usage.complete ? source : `${source} · ${U.partial}`} hl={kind === "calls"} />;
}

const Link = ({ to, children }: { to: "/leaderboard" | "/status"; children: string }) => (
  <Text style={styles.linkVerm} onPress={() => router.push(to)} accessibilityRole="link">
    {children}
  </Text>
);

export function slidesB(usage: VenueUsage): Slide[] {
  return [
    {
      id: "agents",
      section: A.section,
      render: () => (
        <View style={styles.row}>
          <View>
            <Kicker>{A.kicker}</Kicker>
            <H1 size="dense" lines={[A.h1a]} inline={A.h1b} emph={A.emph} />
            <Lead>{A.lead}</Lead>
          </View>
          <SpecPanel i={3} title={A.panelTitle} badge={A.panelBadge} rows={[A.rows[0], A.rows[1], [A.rows[2][0], A.rows[2][1], true], [A.rows[3][0], A.rows[3][1], true], A.rows[4]]} />
        </View>
      ),
    },
    {
      id: "demand",
      section: U.section,
      paper: 2,
      render: () => (
        <View>
          <Kicker>{U.kicker}</Kicker>
          <H1 size="dense" lines={[U.h1a]} inline={U.h1b} emph={U.emph} />
          <View style={styles.stack32}>
            <UsageStat usage={usage} kind="wallets" i={2} />
            <UsageStat usage={usage} kind="calls" i={3} />
            <StatCard i={4} value={U.exact} label={U.exactLabel} source={U.exactSource} />
          </View>
          <Rise i={5} style={styles.noteWrap}>
            <Text style={styles.note}>{U.lead}</Text>
          </Rise>
        </View>
      ),
    },
    {
      id: "revenue",
      section: R.section,
      render: () => (
        <View>
          <Kicker>{R.kicker}</Kicker>
          <H1 size="dense" inline={R.h1a} emph={R.emph} />
          <View style={styles.panels}>
            <SpecPanel i={2} title={R.modelTitle} rows={[R.modelRows[0], R.modelRows[1], [R.modelRows[2][0], R.modelRows[2][1], true], R.modelRows[3]]} />
            <SpecPanel i={3} title={R.seamTitle} badge={R.seamBadge} badgeTone="verm" rows={[R.seamRows[0], R.seamRows[1], [R.seamRows[2][0], R.seamRows[2][1], true], R.seamRows[3]]} />
          </View>
          <Rise i={4} style={styles.noteWrap}>
            <Text style={styles.note}>{R.lead}</Text>
          </Rise>
        </View>
      ),
    },
    {
      id: "why-solana",
      section: W.section,
      paper: 2,
      render: () => (
        <View style={styles.row}>
          <View>
            <Kicker>{W.kicker}</Kicker>
            <H1 size="art" lines={[W.h1a]} inline={W.h1b} emph={W.emph} />
            <Lead>{W.lead}</Lead>
          </View>
          <SpecPanel
            i={3}
            title={W.panelTitle}
            badge={W.panelBadge}
            rows={[
              [W.labels.venue, `${W.labels.venueValue} · ${shortAddr(EVENTS_PROGRAM)}`, true],
              [W.labels.settlement, W.labels.settlementValue, true],
              [W.labels.oracle, W.labels.oracleValue],
              [W.labels.tokens, `${W.labels.tokensValue} · ${shortAddr(VAULT_PROGRAM)}`],
              [W.labels.indexer, W.labels.indexerValue],
              [W.labels.gas, W.labels.gasValue],
            ]}
          />
        </View>
      ),
    },
    {
      id: "team",
      section: T.section,
      paper: 2,
      render: () => (
        <View>
          <Kicker>{T.kicker}</Kicker>
          <H1 size="dense" lines={[T.h1a]} inline={T.h1b} emph={T.emph} />
          <Rise i={2} style={styles.team}>
            <View style={styles.teamAvatar}>
              <AgariMark width={30} height={30} figure={PP.ink} />
            </View>
            <View style={styles.teamText}>
              <Text style={styles.teamName}>
                {T.name} <Text style={styles.teamRole}>· {T.role}</Text>
              </Text>
              <Text style={styles.teamBody}>{T.body}</Text>
            </View>
          </Rise>
        </View>
      ),
    },
    {
      id: "roadmap",
      section: RM.section,
      render: () => (
        <View>
          <Kicker>{RM.kicker}</Kicker>
          <H1 size="art" inline={RM.h1a} emph={RM.emph} />
          <View style={styles.stack32}>
            <PhaseCard i={2} tone="live" tag={RM.now.tag} title={RM.now.title} body={RM.now.body} />
            <PhaseCard i={3} tag={RM.next.tag} title={RM.next.title} body={RM.next.body} />
            <PhaseCard i={4} tag={RM.then.tag} title={RM.then.title} body={RM.then.body} />
          </View>
          <Rise i={5} style={styles.roadmapFoot}>
            <Mono tone="live" size={12}>
              {RM.foot}
            </Mono>
          </Rise>
        </View>
      ),
    },
    {
      id: "close",
      section: CL.section,
      paper: 2,
      render: () => (
        <View style={styles.row}>
          <View>
            <Kicker>{CL.kicker}</Kicker>
            <H1 size="close" lines={[CL.h1a]} emph={CL.emph} />
            <Lead>{CL.lead}</Lead>
            <Rise i={3} style={styles.askWrap}>
              <Text style={styles.ask}>
                {CL.ask} <Link to="/leaderboard">/leaderboard</Link> · <Link to="/status">/status</Link>
              </Text>
            </Rise>
          </View>
          <PhoneMock won tilt={2} i={4} />
        </View>
      ),
    },
  ];
}

const styles = StyleSheet.create({
  row: { gap: 28 },
  stack32: { marginTop: 32, gap: 16 },
  panels: { marginTop: 32, gap: 48 },
  noteWrap: { marginTop: 28 },
  note: { fontFamily: FONT.dataRegular, fontSize: 14.5, lineHeight: 23.2, color: PP.body },
  team: { marginTop: 32, flexDirection: "row", alignItems: "center", gap: 20, backgroundColor: PP.card, borderWidth: 1, borderColor: PP.hair, borderLeftWidth: 3, borderLeftColor: PP.verm, borderRadius: 12, paddingVertical: 20, paddingHorizontal: 24 },
  teamAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: PP.paper2, borderWidth: 1, borderColor: PP.hair, alignItems: "center", justifyContent: "center" },
  teamText: { flex: 1 },
  teamName: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 28, color: PP.ink },
  teamRole: { fontFamily: FONT.body, fontSize: 15, color: PP.mute },
  teamBody: { marginTop: 6, fontFamily: FONT.dataRegular, fontSize: 13.5, lineHeight: 20.25, color: PP.body },
  roadmapFoot: { marginTop: 28, alignSelf: "flex-start", borderTopWidth: 2, borderTopColor: PP.green, paddingTop: 12 },
  askWrap: { marginTop: 24 },
  ask: { fontFamily: FONT.dataRegular, fontSize: 15, lineHeight: 22.5, color: PP.ink },
  linkVerm: { fontFamily: FONT.dataRegular, fontSize: 11, color: PP.verm },
});
