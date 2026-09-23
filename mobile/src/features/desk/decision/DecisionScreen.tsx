import { deskRecordSchema, nameOf, type DeskRecordBody } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { DESK, DESK_ADVICE } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { ago, pct, pctSigned, stamp, tokensText, usdText } from "@/features/desk/format";
import type { DecisionWire } from "@/features/desk/protocol";
import { useDecision, useDeskView, useInvalidateDesk } from "@/features/desk/useDesk";
import { nativeDeskView as deskView } from "../native-view";
import { useWalletSession } from "@/lib/wallet-session";
import { ErrorState, LoadingState, Row, Rows, Screen } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Eyebrow, TONE, toneInk } from "../kit";
import { useDeskClock } from "../useDeskClock";
import { CheckIt } from "./CheckIt";
import { DecisionHero } from "./DecisionHero";
import { CostShown, LimitsCheck, Options, WhatItSaw } from "./DecisionSaw";

const D = RECORD.decision;

/** One section on the stepper's rail; the number is passed in, so a page with no cost section reads without a gap. */
function Section({ n, title, icon, children }: { n: number; title: string; icon: SymbolViewProps["name"]; children: ReactNode }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.duration(350).delay(Math.min(n, 9) * 40)} style={styles.step}>
      <View style={styles.rail}>
        <View style={[styles.stepIcon, { backgroundColor: color.surface2, borderColor: color.hairline }]}>
          <SymbolView name={icon} size={14} tintColor={color.inkSecondary} />
        </View>
        <View style={[styles.railLine, { backgroundColor: color.hairline }]} />
      </View>
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={title}>
        <Text style={[TYPE.title, { color: color.ink }]} accessibilityRole="header">
          <Text style={{ color: color.accent }}>{String(n).padStart(2, "0")} · </Text>
          {title}
        </Text>
        {children}
      </View>
    </Animated.View>
  );
}

function triggerLine(body: DeskRecordBody): string {
  const entry = D.trigger[body.wake.trigger];
  if (typeof entry === "function") return entry(body.candidate ? nameOf(body.candidate.symbol) : "", "");
  return entry ?? D.routine;
}

function gradeLine(grade: NonNullable<DecisionWire["grade"]>): string {
  if (grade.verdict === "no_real_difference") return D.grade.same;
  if (grade.verdict === "ungradable") return D.grade.ungradable;
  if (grade.verdict === "better") return grade.differenceBps !== null && /acting/i.test(grade.why) ? D.grade.betterActed(pct(grade.differenceBps)) : D.grade.better(pct(grade.differenceBps ?? 0));
  return /waiting/i.test(grade.why) ? D.grade.worseActed(pct(grade.differenceBps ?? 0)) : D.grade.worse(pct(grade.differenceBps ?? 0));
}

/** One decision in full (web's DecisionSections.tsx): the verdict hero, then the nine sections as a stepper. */
function DecisionSections({ decision, nowSec, zone, ceilingBps }: { decision: DecisionWire; nowSec: number; zone: string | null; ceilingBps: number | null }) {
  const { color } = useTheme();
  const { record, actions, grade, proof } = decision;
  const parsed = deskRecordSchema.safeParse(record.body);
  const body = parsed.success ? parsed.data : null;
  const isOwner = decision.viewer === "owner";
  const isLive = proof.kind !== "practice";
  const confidence = body?.timing?.decision?.confidencePercent ?? null;
  let count = 0;
  const n = () => ++count;
  return (
    <>
      <Eyebrow text={isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice} live={isLive} />
      {!isOwner ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK.visitor}</Text> : null}
      <DecisionHero decision={decision} body={body} zone={zone} />
      <View accessibilityLabel={DECISION.stepsAria}>
        <Section n={n()} title={D.sections.decision} icon={{ ios: "hammer", android: "gavel" }}>
          <Rows>
            <Row label={D.what} value={<Text style={[TYPE.bodyStrong, { color: toneInk(TONE[record.outcome], color) }]}>{RECORD.outcome[record.outcome]}{record.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""}</Text>} />
            <Row label={D.when} value={stamp(record.decidedAtSec, zone)} />
            <Row label={D.mode} value={DESK.modes[record.mode]} />
            <Row label={D.howSure} value={confidence === null ? D.noModel : `${confidence}%`} />
          </Rows>
          {body?.override ? <Text style={[TYPE.body, { color: color.warning }]}>{D.override(body.override.by, body.override.reason)}</Text> : null}
          {body?.approvalOf ? <Text style={[TYPE.body, { color: color.inkSecondary }]}>{D.approvalOf(body.approvalOf.decisionSeq, ago(Math.floor(Date.parse(body.approvalOf.answeredAt) / 1000), nowSec), pctSigned(body.approvalOf.movedBps))}</Text> : null}
        </Section>
        <Section n={n()} title={D.sections.why} icon={{ ios: "magnifyingglass", android: "search" }}>
          <Text style={[TYPE.body, { color: color.ink }]}>{body ? (body.candidate?.why ?? triggerLine(body)) : D.routine}</Text>
          {body?.candidate ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{triggerLine(body)}</Text> : null}
          {body?.deferral ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{D.deferral(body.deferral.decisionSeq)} {body.deferral.stillStanding ? D.deferralStanding : (body.deferral.endedBecause ?? "")}</Text> : null}
        </Section>
        <Section n={n()} title={D.sections.saw} icon={{ ios: "eye", android: "visibility" }}>
          {body ? <WhatItSaw body={body} ceilingBps={ceilingBps} /> : <Text style={[TYPE.body, { color: color.inkSecondary }]}>{D.saw.nothing}</Text>}
        </Section>
        <Section n={n()} title={D.sections.options} icon={{ ios: "arrow.triangle.branch", android: "call_split" }}>
          {body ? <Options body={body} /> : <Text style={[TYPE.body, { color: color.inkSecondary }]}>{D.options.noModel}</Text>}
        </Section>
        <Section n={n()} title={D.sections.limits} icon={{ ios: "checkmark.shield", android: "verified_user" }}>
          {body ? <LimitsCheck body={body} /> : <Text style={[TYPE.body, { color: color.inkSecondary }]}>{D.limits.nothing}</Text>}
        </Section>
        {body?.preview ? (
          <Section n={n()} title={D.sections.cost} icon={{ ios: "doc.text", android: "receipt_long" }}>
            <CostShown body={body} />
          </Section>
        ) : null}
        <Section n={n()} title={D.sections.happened} icon={{ ios: "bolt", android: "bolt" }}>
          {record.mode === "practice" ? (
            <>
              <Text style={[TYPE.body, { color: color.inkSecondary }]}>{D.happened.practice}</Text>
              {body?.paper ? (
                <Rows>
                  <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{D.happened.paperAfter}</Text>
                  <Row label={DECISION.cash} value={`${usdText(body.paper.cash)} USDC`} />
                  {Object.entries(body.paper.positions).map(([symbol, raw]) => (
                    <View key={symbol} style={styles.ledger}>
                      <AssetDisc asset={symbol} size={20} />
                      <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>{nameOf(symbol as PreIpoSymbol)}</Text>
                      <Text style={[TYPE.data, { color: color.ink }]}>
                        {tokensText(raw)} {symbol}
                      </Text>
                    </View>
                  ))}
                </Rows>
              ) : null}
            </>
          ) : actions.length === 0 ? (
            <Text style={[TYPE.body, { color: color.inkSecondary }]}>{D.happened.nothingSent}</Text>
          ) : (
            actions.map((a) => (
              <View key={a.leg} style={[styles.action, { borderColor: a.status === "confirmed" ? color.profit : a.failureCode ? color.loss : color.hairline }]}>
                <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
                  {a.kind} · {a.status.replace(/_/g, " ")}
                </Text>
                {a.actualOut !== null && a.expectedOut !== null ? <Text style={[TYPE.data, { color: color.inkSecondary }]}>{D.happened.received(a.actualOut, a.expectedOut)}</Text> : null}
                {a.failureCode ? <Text style={[TYPE.caption, { color: color.loss }]}>{D.happened.failed(`${a.failureCode}${a.failureDetail ? `: ${a.failureDetail}` : ""}`)}</Text> : null}
                {a.signature ? (
                  <Pressable onPress={() => void openExternal(txUrl(a.signature as Signature, "mainnet-beta"))} accessibilityRole="link" hitSlop={8}>
                    <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{D.happened.explorer}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </Section>
        <Section n={n()} title={D.sections.proof} icon={{ ios: "touchid", android: "fingerprint" }}>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{proof.kind === "own" ? D.proof.own : proof.kind === "later" ? D.proof.later(proof.sealingSeq) : proof.kind === "unsealed" ? D.proof.unsealed : D.proof.practice}</Text>
          <CheckIt body={record.body} recordHash={record.recordHash} proof={proof} />
        </Section>
        <Section n={n()} title={D.sections.now} icon={{ ios: "hourglass", android: "hourglass_top" }}>
          <Text style={[TYPE.body, { color: grade ? (grade.verdict === "better" ? color.profit : grade.verdict === "worse" ? color.loss : color.ink) : color.inkSecondary }]}>{grade ? gradeLine(grade) : D.grade.notYet}</Text>
        </Section>
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK_ADVICE}</Text>
    </>
  );
}

/** `/desk/[id]/decision/[seq]` (web's DecisionScreen.tsx): one decision read live; the desk's view adds the ceiling. */
export function DecisionScreen({ id, seq }: { id: string; seq: number }) {
  const { address } = useWalletSession();
  const { nowSec, zone } = useDeskClock();
  const invalidate = useInvalidateDesk();
  const reading = useDecision(id, seq, address);
  const desk = useDeskView(id, address);
  const view = desk && isOk(desk) ? deskView(desk.value) : null;
  const ceilingBps = view && (view.mandate || view.wire.chain) ? view.limits.maxPremiumBps : null;
  return (
    <Screen title={DECISION.seq(seq)} onRefresh={invalidate}>
      {reading === null ? <LoadingState shape="plate" /> : null}
      {reading === null ? <LoadingState shape="list" /> : null}
      {reading !== null && !isOk(reading) ? <ErrorState diagnosis={reading.error} retry={() => void invalidate()} /> : null}
      {reading !== null && isOk(reading) ? <DecisionSections decision={reading.value} nowSec={nowSec} zone={zone} ceilingBps={ceilingBps} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 10 },
  rail: { width: 28, alignItems: "center" },
  stepIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", marginTop: 14 },
  railLine: { width: 1, flex: 1 },
  card: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, gap: 10, marginBottom: 12 },
  grow: { flex: 1 },
  ledger: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 30 },
  action: { borderWidth: 1, borderRadius: RADIUS.md, padding: 10, gap: 4 },
});
