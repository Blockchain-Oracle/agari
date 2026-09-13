"use client";

import type { TxOutcome } from "@masayume/core/ports";
import { diagnosis, type Address } from "@masayume/core/types";
import type { VaultGrant } from "@masayume/core/vault";
import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { RouteControl, SESSION, SessionChip, SessionControl, SessionManagerBody, type FundingSource, type SessionKeyView, type SessionStatus } from "@/features/session";
import { SessionModalShell } from "@/features/session/SessionModal";
import { CapabilityReceipt } from "@/features/session/CapabilityReceipt";

const ONE = 1_000_000n;
const OWNER = "0xd357019E2c55375477802A047dB7bC1A77819358" as Address;
const KEY = "0x00000000000000000000000000000000000000aa" as Address;
const OTHER_KEY = "0x00000000000000000000000000000000000000bb" as Address;
const VAULT = "0x0000000000000000000000000000000000000ee1" as Address;
const NOW_SEC = 1_788_400_000;
const SYMBOL = "tUSDC";

function grant(actor: Address, expiresAtSec: number, revoked = false): VaultGrant {
  return {
    grantId: 7n,
    owner: OWNER,
    actor,
    kind: "session",
    revoked,
    expiresAtSec,
    spentDay: Math.floor(NOW_SEC / 86_400),
    spentTodayBase: 12n * ONE,
    openPositions: 2,
    caps: { maxStakePerTradeBase: 5n * ONE, maxDailySpendBase: 25n * ONE, maxOpenPositions: 4, maxPriceRaw: 950_000n },
    budgetBase: 13n * ONE,
  };
}

function view(status: SessionStatus, extra: Partial<SessionKeyView> = {}): SessionKeyView {
  return {
    status,
    owner: OWNER,
    key: { address: KEY },
    grant: null,
    deployment: { chainId: 50312, eventVault: VAULT, forwarder: VAULT, collateral: VAULT, fromBlock: 0n },
    decimals: 6,
    nowSec: NOW_SEC,
    sponsor: { configured: false, sponsor: null, balanceWei: null, forwarder: null, allowlist: [] },
    sponsorRefusal: null,
    keyGasWei: 720_000_000_000_000_000n,
    vaultAvailableBase: 40n * ONE,
    ...extra,
  };
}

const refused: TxOutcome = { status: "refused", diagnosis: diagnosis("unknown", "fixtures never sign") };
const noop = {
  enable: async () => ({ outcome: refused, topUpHash: null, topUpError: null }),
  rekey: async () => ({ outcome: refused, topUpHash: null, topUpError: null }),
  revoke: async () => refused,
  topUp: async () => null,
  forget: async () => undefined,
};

const VIEWS: Array<{ label: string; view: SessionKeyView }> = [
  { label: "not deployed", view: view("not-deployed", { deployment: null, vaultAvailableBase: null }) },
  { label: "no wallet", view: view("no-wallet", { owner: null, key: null }) },
  { label: "disarmed", view: view("disarmed") },
  { label: "armed · key pays", view: view("armed", { grant: grant(KEY, NOW_SEC + 6 * 3600) }) },
  {
    label: "armed · sponsor on",
    view: view("armed", { grant: grant(KEY, NOW_SEC + 6 * 3600), sponsor: { configured: true, sponsor: VAULT, balanceWei: 5n * 10n ** 18n, forwarder: VAULT, allowlist: ["placeFor"] }, keyGasWei: 0n }),
  },
  { label: "armed · key empty", view: view("armed", { grant: grant(KEY, NOW_SEC + 6 * 3600), keyGasWei: 0n }) },
  {
    label: "armed · sponsor declined",
    view: view("armed", {
      grant: grant(KEY, NOW_SEC + 6 * 3600),
      sponsor: { configured: true, sponsor: VAULT, balanceWei: 0n, forwarder: VAULT, allowlist: ["placeFor"] },
      sponsorRefusal: "The sponsorship allowance for this transaction has been exhausted. The browser key must cover the network fee.",
    }),
  },
  {
    label: "armed · no price cap",
    view: view("armed", { grant: { ...grant(KEY, NOW_SEC + 6 * 3600), caps: { ...grant(KEY, NOW_SEC).caps, maxPriceRaw: 0n } } }),
  },
  { label: "grant without key", view: view("grant-without-key", { grant: grant(OTHER_KEY, NOW_SEC + 6 * 3600), key: null }) },
  { label: "expired", view: view("expired", { grant: grant(KEY, NOW_SEC - 60) }) },
];

function ManagerFixture({ label, view: current }: { label: string; view: SessionKeyView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="type-caption text-ink-secondary">{label}</span>
        <button type="button" className="type-caption underline underline-offset-4" onClick={() => setOpen(true)}>Preview {label}</button>
      </div>
      <SessionChip status={current.status} onClick={() => setOpen(true)} />
      <SessionManagerBody view={current} actions={noop} busy={null} symbol={SYMBOL} onArmNew={() => undefined} />
      <SessionModalShell open={open} onClose={() => setOpen(false)} title={SESSION.manager.title} description={SESSION.manager.description} labelId={`session-fixture-${current.status}-${label.replaceAll(" ", "-")}`}>
        <SessionManagerBody view={current} actions={noop} busy={null} symbol={SYMBOL} onArmNew={() => undefined} />
      </SessionModalShell>
    </div>
  );
}

function RouteFixture({ label, armed, deployed, vault }: { label: string; armed: boolean; deployed: boolean; vault: bigint | null }) {
  const [source, setSource] = useState<FundingSource>("wallet");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-4">
      <span className="type-caption text-ink-secondary">{label}</span>
      <RouteControl source={source} onChange={setSource} vaultAvailableBase={vault} decimals={6} symbol={SYMBOL} armed={armed} deployed={deployed} />
    </div>
  );
}

export function SessionFixtures() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-8 px-gutter py-8">
      <SectionHeader index="00" title={SESSION.dev.title} />
      <p className="type-body text-ink-secondary">{SESSION.dev.intro}</p>

      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title={SESSION.dev.states} />
        {VIEWS.map(({ label, view: v }) => <ManagerFixture key={label} label={label} view={v} />)}
        <CapabilityReceipt keyAddress={KEY} expiresAtSec={NOW_SEC + 6 * 3600} sponsorConfigured topUpWei={0n} firstTime />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title={SESSION.dev.route} />
        <RouteFixture label="not deployed" armed={false} deployed={false} vault={null} />
        <RouteFixture label="deployed · vault empty" armed={false} deployed vault={0n} />
        <RouteFixture label="deployed · vault funded" armed={false} deployed vault={40n * ONE} />
        <RouteFixture label="armed" armed deployed vault={40n * ONE} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="03" title={SESSION.dev.live} />
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-1 p-4">
          <span className="type-caption text-ink-secondary">{SESSION.dev.sheet}</span>
          <SessionControl symbol={SYMBOL} />
        </div>
      </section>
    </div>
  );
}
