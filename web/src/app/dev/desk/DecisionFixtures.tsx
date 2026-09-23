"use client";

import { DEFAULT_LIMITS, hashRecord, PLANNED_OUTCOMES } from "@agari/core/desk";
import { SectionHeader } from "@/components/chrome";
import { CheckIt, type CheckItResult } from "@/features/desk/CheckIt";
import { RECORD } from "@/features/desk/copy-record";
import { DecisionSkeleton } from "@/features/desk/decision/DecisionSkeleton";
import { DecisionSections } from "@/features/desk/DecisionSections";
import { Fixture } from "../states/_sections/Fixture";
import { decisionOf, DESK_ID, NOW_SEC, TAMPERED } from "./fixtures-records";

const DEV = {
  decisions: "One decision of each outcome, in the nine sections",
  checkIt: "Check it — passing on an honest record, failing on a tampered byte, and a live mismatch",
  passing: "An honest practice record: the browser's fingerprint matches the stored one",
  tampered: "The same record with one figure changed (the candidate's $50 became $500): it does NOT match",
  mismatch: "A live record whose transaction holds a different fingerprint",
  loading: "A decision while it loads",
} as const;

const honest = TAMPERED.honest;
const PASSING: CheckItResult = { computed: honest.summary.recordHash, storedOk: true, links: [], expected: honest.summary.recordHash, chain: "practice" };
const FAILING: CheckItResult = { computed: hashRecord(TAMPERED.body), storedOk: false, links: [], expected: hashRecord(TAMPERED.body), chain: "practice" };
const live = decisionOf("ACTED");
const MISMATCH: CheckItResult = { computed: live.record.recordHash, storedOk: true, links: [], expected: live.record.recordHash, chain: "mismatch", eventHash: `0x${"c0".repeat(32)}` };

/** The eleven outcomes as full decision pages, then Check it in its three verdicts. */
export function DecisionFixtures({ zone }: { zone: string | null }) {
  return (
    <>
      <section className="flex flex-col gap-4">
        <SectionHeader index="09" title={DEV.decisions} />
        {PLANNED_OUTCOMES.map((outcome) => {
          const decision = decisionOf(outcome);
          return (
            <div key={outcome} id={`decision-${outcome}`}>
              <Fixture label={`${RECORD.outcome[decision.record.outcome]} · ${outcome}`}>
                <DecisionSections decision={decision} base={`/desk/${DESK_ID}`} nowSec={NOW_SEC} zone={zone} isLive={decision.proof.kind !== "practice"} ceilingBps={DEFAULT_LIMITS.maxPremiumBps} />
              </Fixture>
            </div>
          );
        })}
        <Fixture label={DEV.loading}>
          <DecisionSkeleton />
        </Fixture>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader index="10" title={DEV.checkIt} />
        <Fixture label={DEV.passing}>
          <CheckIt body={honest.body} recordHash={honest.summary.recordHash} proof={{ kind: "practice" }} initial={PASSING} />
        </Fixture>
        <Fixture label={DEV.tampered}>
          <CheckIt body={TAMPERED.body} recordHash={TAMPERED.recordHash} proof={{ kind: "practice" }} initial={FAILING} />
        </Fixture>
        <Fixture label={DEV.mismatch}>
          <CheckIt body={live.record.body} recordHash={live.record.recordHash} proof={live.proof} initial={MISMATCH} />
        </Fixture>
      </section>
    </>
  );
}
