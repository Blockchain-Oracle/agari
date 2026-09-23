import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PITCH } from "@/features/pitch/copy";
import type { VenueUsage } from "@/features/pitch/useVenueUsage";
import { AgariMark } from "~/components/shell/AgariMark";
import { marketsEnv } from "~/lib/env";
import { RADIUS, TYPE } from "~/theme";
import { CountUp, H1, Kicker, Lead, Mono, PAPER, Rise, Sheet, SpecPanel, StatCard } from "./Folio";
import { PhoneMock } from "./Mocks";
import type { Page } from "./Pager";

/**
 * Slides 09–15 — web pitch/slides-b.tsx, in web's words. The "real usage" slide reads the venue live through web's
 * own `useVenueUsage` (`/api/leaderboard`, the fill tape replayed), and says "reading" or "unreadable" rather than
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
  if (usage.state !== "ok") {
    const word = usage.state === "reading" ? U.reading : U.unavailable;
    return <StatCard i={i} value={<Text style={[TYPE.body, { color: PAPER.inkMuted }]}>{word}</Text>} label={label} source={source} />;
  }
  const n = kind === "wallets" ? usage.rankedTraders : usage.closedCalls;
  return <StatCard i={i} value={<CountUp to={n} />} label={label} source={usage.complete ? source : `${source} · ${U.partial}`} hl={kind === "calls"} />;
}

function Phase({ tag, title, body, live, i }: { tag: string; title: string; body: string; live?: boolean; i: number }) {
  return (
    <Rise i={i}>
      <View style={[styles.phase, { borderColor: live ? PAPER.profit : PAPER.creamHairline }]}>
        <Mono tone={live ? "live" : "verm"}>{tag}</Mono>
        <Text style={[TYPE.title, { color: PAPER.ink }]}>{title}</Text>
        <Text style={[TYPE.caption, { color: PAPER.inkSecondary }]}>{body}</Text>
      </View>
    </Rise>
  );
}

export function slidesB(usage: VenueUsage): Page[] {
  return [
    {
      id: "agents",
      section: A.section,
      render: () => (
        <Sheet>
          <Kicker>{A.kicker}</Kicker>
          <H1 lines={[A.h1a, A.h1b]} emph={A.emph} />
          <Lead>{A.lead}</Lead>
          <SpecPanel
            title={A.panelTitle}
            badge={A.panelBadge}
            rows={[A.rows[0], A.rows[1], [A.rows[2][0], A.rows[2][1], true], [A.rows[3][0], A.rows[3][1], true], A.rows[4]]}
          />
        </Sheet>
      ),
    },
    {
      id: "demand",
      section: U.section,
      render: () => (
        <Sheet paper={2}>
          <Kicker>{U.kicker}</Kicker>
          <H1 lines={[U.h1a, U.h1b]} emph={U.emph} />
          <UsageStat usage={usage} kind="wallets" i={2} />
          <UsageStat usage={usage} kind="calls" i={3} />
          <StatCard i={4} value={U.exact} label={U.exactLabel} source={U.exactSource} />
          <Lead i={5}>{U.lead}</Lead>
        </Sheet>
      ),
    },
    {
      id: "revenue",
      section: R.section,
      render: () => (
        <Sheet>
          <Kicker>{R.kicker}</Kicker>
          <H1 lines={[]} inline={R.h1a} emph={R.emph} />
          <SpecPanel i={2} title={R.modelTitle} rows={[R.modelRows[0], R.modelRows[1], [R.modelRows[2][0], R.modelRows[2][1], true], R.modelRows[3]]} />
          <SpecPanel
            i={3}
            title={R.seamTitle}
            badge={R.seamBadge}
            badgeTone="verm"
            rows={[R.seamRows[0], R.seamRows[1], [R.seamRows[2][0], R.seamRows[2][1], true], R.seamRows[3]]}
          />
          <Lead i={4}>{R.lead}</Lead>
        </Sheet>
      ),
    },
    {
      id: "why-solana",
      section: W.section,
      render: () => (
        <Sheet paper={2}>
          <Kicker>{W.kicker}</Kicker>
          <H1 lines={[W.h1a, W.h1b]} emph={W.emph} />
          <Lead>{W.lead}</Lead>
          <SpecPanel
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
        </Sheet>
      ),
    },
    {
      id: "team",
      section: T.section,
      render: () => (
        <Sheet paper={2}>
          <Kicker>{T.kicker}</Kicker>
          <H1 lines={[T.h1a, T.h1b]} emph={T.emph} />
          <Rise i={2}>
            <View style={styles.team}>
              <View style={[styles.avatar, { backgroundColor: PAPER.ink }]}>
                <AgariMark width={24} height={24} figure={PAPER.cream} />
              </View>
              <View style={styles.teamText}>
                <Text style={[TYPE.title, { color: PAPER.ink }]}>{T.name}</Text>
                <Mono tone="mute">{T.role}</Mono>
                <Text style={[TYPE.body, { color: PAPER.inkSecondary }]}>{T.body}</Text>
              </View>
            </View>
          </Rise>
        </Sheet>
      ),
    },
    {
      id: "roadmap",
      section: RM.section,
      render: () => (
        <Sheet>
          <Kicker>{RM.kicker}</Kicker>
          <H1 lines={[]} inline={RM.h1a} emph={RM.emph} />
          <Phase i={2} live tag={RM.now.tag} title={RM.now.title} body={RM.now.body} />
          <Phase i={3} tag={RM.next.tag} title={RM.next.title} body={RM.next.body} />
          <Phase i={4} tag={RM.then.tag} title={RM.then.title} body={RM.then.body} />
          <Mono tone="live">{RM.foot}</Mono>
        </Sheet>
      ),
    },
    {
      id: "close",
      section: CL.section,
      render: () => (
        <Sheet paper={2}>
          <Kicker>{CL.kicker}</Kicker>
          <H1 lines={[CL.h1a]} emph={CL.emph} />
          <Lead>{CL.lead}</Lead>
          <Rise i={3}>
            <Text style={[TYPE.body, { color: PAPER.ink }]}>
              {CL.ask}{" "}
              <Link href="/leaderboard" style={{ color: PAPER.accent }}>
                /leaderboard
              </Link>
              {" · "}
              <Link href="/status" style={{ color: PAPER.accent }}>
                /status
              </Link>
            </Text>
          </Rise>
          <PhoneMock won i={4} />
        </Sheet>
      ),
    },
  ];
}

const styles = StyleSheet.create({
  phase: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14, gap: 6 },
  team: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  teamText: { flex: 1, gap: 6 },
});
