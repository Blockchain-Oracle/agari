import { deskRecordSchema, nameOf, type DeskRecordBody } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { ArrowUpRight, Eye, Fingerprint, Gavel, Hourglass, Radar, Receipt, Search, ShieldCheck, Split, TrendingDown, TrendingUp, Zap } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK, DESK_ADVICE } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { ago, pct, pctSigned, stamp, tokensText, usdText } from "@/features/desk/format";
import type { DecisionWire } from "@/features/desk/protocol";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { DkLink, DT, Eyebrow, TONE, toneInk, useDeskTheme } from "../kit";
import { CheckIt } from "./CheckIt";
import { DecisionHero } from "./DecisionHero";
import { CostShown, LimitsCheck, Options, WhatItSaw } from "./DecisionSaw";
import { DcBadge, Facts, Section, Steps, Subhead } from "./parts";

const D = RECORD.decision;

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

/** `.dc-ledger-row` at phone width: the mark, then the name over the figure. */
function LedgerRow({ mark, label, value }: { mark: ReactNode; label: string; value: string }) {
  const { color } = useDeskTheme();
  return (
    <View style={styles.ledgerRow}>
      {mark}
      <View style={styles.grow}>
        <Text style={[styles.ledgerText, { color: color.inkSecondary }]}>{label}</Text>
        <Text style={[styles.ledgerText, styles.b, { color: color.ink }]}>{value}</Text>
      </View>
    </View>
  );
}

/** One decision in full (web's DecisionSections.tsx): the eyebrow and way back, the verdict hero, then the sections on the stepper rail. */
export function DecisionSections({ decision, base, nowSec, zone, ceilingBps }: { decision: DecisionWire; base: string; nowSec: number; zone: string | null; ceilingBps: number | null }) {
  const { color } = useDeskTheme();
  const { record, actions, grade, proof } = decision;
  const parsed = deskRecordSchema.safeParse(record.body);
  const body = parsed.success ? parsed.data : null;
  const isOwner = decision.viewer === "owner";
  const isLive = proof.kind !== "practice";
  const confidence = body?.timing?.decision?.confidencePercent ?? null;
  let count = 0;
  const n = () => ++count;
  const muted = (text: string) => <Text style={[DT.body, { color: color.inkSecondary }]}>{text}</Text>;
  const GradeIcon = grade?.verdict === "better" ? TrendingUp : grade?.verdict === "worse" ? TrendingDown : ArrowUpRight;
  return (
    <>
      <View style={styles.hero}>
        <Eyebrow text={isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice} live={isLive} />
        <DkLink label={D.back} href={`${base}/record`} />
        {!isOwner ? <Text style={[DT.caption, { color: color.inkMuted }]}>{DESK.visitor}</Text> : null}
      </View>
      <DecisionHero decision={decision} body={body} zone={zone} />
      <Steps label={DECISION.stepsAria}>
        <Section n={n()} title={D.sections.decision} icon={Gavel}>
          <Facts
            rows={[
              [D.what, <Text key="v" style={[styles.verdictInline, { color: TONE[record.outcome] === "quiet" ? color.inkSecondary : toneInk(TONE[record.outcome], color) }]}>{RECORD.outcome[record.outcome]}{record.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""}</Text>],
              [D.when, stamp(record.decidedAtSec, zone)],
              [D.mode, DESK.modes[record.mode]],
              [D.howSure, confidence === null ? D.noModel : `${confidence}%`],
            ]}
          />
          {body?.override ? <Text style={[DT.body, { color: color.warning }]}>{D.override(body.override.by, body.override.reason)}</Text> : null}
          {body?.approvalOf ? muted(D.approvalOf(body.approvalOf.decisionSeq, ago(Math.floor(Date.parse(body.approvalOf.answeredAt) / 1000), nowSec), pctSigned(body.approvalOf.movedBps))) : null}
        </Section>

        <Section n={n()} title={D.sections.why} icon={Search}>
          {body ? (
            <>
              <Text style={[styles.lead, { color: color.ink }]}>{body.candidate?.why ?? triggerLine(body)}</Text>
              {body.candidate ? (
                <View style={[styles.chip, { backgroundColor: color.surface2 }]}>
                  <Radar size={14} color={color.accent} />
                  <Text style={[styles.chipText, { color: color.inkSecondary }]}>{triggerLine(body)}</Text>
                </View>
              ) : null}
              {body.deferral ? (
                <Text style={[DT.caption, { color: color.inkSecondary }]}>
                  {D.deferral(body.deferral.decisionSeq)} {body.deferral.stillStanding ? D.deferralStanding : (body.deferral.endedBecause ?? "")}
                </Text>
              ) : null}
            </>
          ) : (
            muted(D.routine)
          )}
        </Section>

        <Section n={n()} title={D.sections.saw} icon={Eye}>{body ? <WhatItSaw body={body} ceilingBps={ceilingBps} /> : muted(D.saw.nothing)}</Section>
        <Section n={n()} title={D.sections.options} icon={Split}>{body ? <Options body={body} /> : muted(D.options.noModel)}</Section>
        <Section n={n()} title={D.sections.limits} icon={ShieldCheck}>{body ? <LimitsCheck body={body} /> : muted(D.limits.nothing)}</Section>
        {body?.preview ? (
          <Section n={n()} title={D.sections.cost} icon={Receipt}>
            <CostShown body={body} />
          </Section>
        ) : null}

        <Section n={n()} title={D.sections.happened} icon={Zap}>
          {record.mode === "practice" ? (
            <>
              {muted(D.happened.practice)}
              {body?.paper ? (
                <View style={[styles.ledger, { borderColor: color.hairline }]} accessibilityLabel={D.happened.paperAfter}>
                  <Subhead>{D.happened.paperAfter}</Subhead>
                  <LedgerRow
                    mark={
                      <View style={[styles.usdc, { backgroundColor: color.markUsdc }]}>
                        <Text style={[styles.usdcText, { color: color.markGlyph }]}>$</Text>
                      </View>
                    }
                    label={DECISION.cash}
                    value={`${usdText(body.paper.cash)} USDC`}
                  />
                  {Object.entries(body.paper.positions).map(([symbol, raw]) => (
                    <LedgerRow key={symbol} mark={<AssetDisc asset={symbol} size={24} />} label={nameOf(symbol as PreIpoSymbol)} value={`${tokensText(raw)} ${symbol}`} />
                  ))}
                </View>
              ) : null}
            </>
          ) : actions.length === 0 ? (
            muted(D.happened.nothingSent)
          ) : (
            <View style={styles.actions}>
              {actions.map((a) => (
                <View key={a.leg} style={[styles.action, { borderColor: color.hairline }]}>
                  <View style={styles.actionHead}>
                    <Text style={[styles.kind, { color: color.ink }]}>{a.kind}</Text>
                    <DcBadge tone={a.status === "confirmed" ? "ok" : a.failureCode ? "bad" : undefined}>{a.status.replace(/_/g, " ")}</DcBadge>
                  </View>
                  {a.actualOut !== null && a.expectedOut !== null ? <Text style={[DT.mono, { color: color.inkSecondary }]}>{D.happened.received(a.actualOut, a.expectedOut)}</Text> : null}
                  {a.failureCode ? <Text style={[DT.body, { color: color.warning }]}>{D.happened.failed(`${a.failureCode}${a.failureDetail ? `: ${a.failureDetail}` : ""}`)}</Text> : null}
                  {a.signature ? (
                    <Text style={[styles.explorer, { color: color.accent }]} accessibilityRole="link" onPress={() => void openExternal(txUrl(a.signature as Signature, "mainnet-beta"))}>
                      {D.happened.explorer}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section n={n()} title={D.sections.proof} icon={Fingerprint}>
          {muted(proof.kind === "own" ? D.proof.own : proof.kind === "later" ? D.proof.later(proof.sealingSeq) : proof.kind === "unsealed" ? D.proof.unsealed : D.proof.practice)}
          <CheckIt body={record.body} recordHash={record.recordHash} proof={proof} />
        </Section>

        <Section n={n()} title={D.sections.now} icon={Hourglass}>
          {grade ? (
            <View style={styles.grade}>
              <GradeIcon size={20} color={grade.verdict === "better" ? color.profit : grade.verdict === "worse" ? color.loss : color.inkMuted} />
              <Text style={[styles.gradeText, { color: color.ink }]}>{gradeLine(grade)}</Text>
            </View>
          ) : (
            muted(D.grade.notYet)
          )}
        </Section>
      </Steps>
      <Text style={[DT.caption, { color: color.inkMuted }]}>{DESK_ADVICE}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  verdictInline: { fontFamily: FONT.bodyStrong, fontSize: 11.5, lineHeight: 21.6, letterSpacing: 0.92, textTransform: "uppercase" },
  lead: { fontFamily: FONT.body, fontSize: 16, lineHeight: 24 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", maxWidth: "100%", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 9999 },
  chipText: { flexShrink: 1, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  ledger: { gap: 4, padding: 14, borderWidth: 1, borderStyle: "dashed", borderRadius: 14 },
  ledgerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  ledgerText: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 21.6 },
  b: { fontFamily: FONT.bodyStrong },
  usdc: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  usdcText: { fontFamily: FONT.headingHeavy, fontSize: 12 },
  actions: { gap: 8 },
  action: { gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  actionHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  kind: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 24 },
  explorer: { alignSelf: "flex-start", fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  grade: { flexDirection: "row", alignItems: "center", gap: 10 },
  gradeText: { flex: 1, fontFamily: FONT.body, fontSize: 15.5, lineHeight: 24.8 },
});
