"use client";

import { SectionHeader } from "@/components/chrome";
import { DeskPage } from "@/features/desk/DeskPage";
import { DeskStudio } from "@/features/desk/DeskStudio";
import { MoneySheet } from "@/features/desk/MoneySheet";
import { RecordListView } from "@/features/desk/RecordList";
import { deskView } from "@/features/desk/view";
import { useViewerZone } from "@/lib/when";
import { Fixture } from "../states/_sections/Fixture";
import { DecisionFixtures } from "./DecisionFixtures";
import { BALANCES, fixtureActions, NOW_SEC, OWNER, VIEWS } from "./fixtures";
import { DESK_ID, RECORDS } from "./fixtures-records";

const DEV = {
  title: "The desk",
  intro: "Every state from fixtures (plan §5.11): the studio at each step, the desk page in practice and live, paused, stopped by the loss limit, has not checked in, a frozen name, an approval waiting and one expired, practice progress 4 of 6, the record with a folded quiet run, a decision of each outcome, Check it passing and failing on a tampered byte, the money sheet's receipts, and the shared read-only view. No wallet, no index, no mainnet; nothing here signs or sends.",
  studio: "Studio — 01 the basket, 02 how strict, 03 the test read (the first decision arrived), 04 create",
  practice: "Desk page — practice, 4 of 6 checks, the record not opened, Go live locked",
  live: "Desk page — live on Solana mainnet, asking first; an approval waiting and one expired unanswered",
  paused: "Desk page — paused by the owner",
  stopped: "Desk page — stopped by the loss limit",
  late: "Desk page — has not checked in for three hours",
  frozen: "Desk page — a frozen account, a stale price and a name above the premium ceiling",
  record: "The whole record — 12 checks, two quiet runs folded",
  money: "The money sheet — USDC from this wallet, PreStocks tokens with the 1% fee, then Withdraw",
  shared: "Someone else's desk — the same page read-only, the notes stripped",
} as const;

const actions = fixtureActions();

export function DeskFixtures() {
  const zone = useViewerZone();
  const practice = deskView(VIEWS.practice);
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-10 px-gutter py-8">
      <div className="flex flex-col gap-2">
        <SectionHeader index="S21" title={DEV.title} />
        <p className="type-body text-ink-secondary">{DEV.intro}</p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title={DEV.studio} />
        {[1, 2, 3, 4].map((step) => (
          <Fixture key={step} label={`Step 0${step}`}>
            <DeskStudio owner={OWNER} view={step >= 3 ? practice : null} writes={actions} initialBasket="AILABS" editing={false} onConnect={() => undefined} zone={zone} nowSec={NOW_SEC} initialStep={step} initialRead={step === 3 ? { status: "done", key: null, requestedAtSec: NOW_SEC - 120, throttledUntilSec: null, problem: null } : undefined} />
          </Fixture>
        ))}
      </section>

      {(
        [
          ["02", DEV.practice, VIEWS.practice],
          ["03", DEV.live, VIEWS.live],
          ["04", DEV.paused, VIEWS.paused],
          ["05", DEV.stopped, VIEWS.stopped],
          ["06", DEV.late, VIEWS.late],
          ["07", DEV.frozen, VIEWS.frozen],
        ] as const
      ).map(([index, label, wire]) => (
        <section key={index} className="flex flex-col gap-4">
          <SectionHeader index={index} title={label} />
          <DeskPage view={deskView(wire)} actions={actions} zone={zone} nowSec={NOW_SEC} />
        </section>
      ))}

      <section className="flex flex-col gap-4">
        <SectionHeader index="08" title={DEV.record} />
        <RecordListView records={RECORDS.map((r) => r.summary)} base={`/desk/${DESK_ID}`} nowSec={NOW_SEC} zone={zone} isOwner isLive={false} older={null} />
      </section>

      <DecisionFixtures zone={zone} />

      <section className="flex flex-col gap-4">
        <SectionHeader index="11" title={DEV.money} />
        <div className="grid gap-4 md:grid-cols-2">
          <Fixture label="Put money in">
            <MoneySheet view={deskView(VIEWS.live)} actions={actions} kind="deposit" zone={zone} nowSec={NOW_SEC} onClose={() => undefined} balances={BALANCES} />
          </Fixture>
          <Fixture label="Withdraw">
            <MoneySheet view={deskView(VIEWS.live)} actions={actions} kind="withdraw" zone={zone} nowSec={NOW_SEC} onClose={() => undefined} balances={BALANCES} />
          </Fixture>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="12" title={DEV.shared} />
        <DeskPage view={deskView(VIEWS.shared)} actions={null} zone={zone} nowSec={NOW_SEC} />
      </section>
    </div>
  );
}
