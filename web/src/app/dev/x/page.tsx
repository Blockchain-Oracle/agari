"use client";

import { xGrantCaps, xPermissionState, type XReceipt } from "@masayume/core/x";
import type { VaultGrant } from "@masayume/core/vault";
import { SectionHeader } from "@/components/chrome";
import { ClaimReceiptCard, XReceiptsList, XWalletCardView, type XGrantState, type XLink, type XStatus } from "@/features/x";
import { WALLET } from "../states/fixtures";
import "@/features/x/x.css";
import "@/features/x/x-card.css";
import { X_FIXTURE_NOW_SEC, XUpgradeFixture } from "./XUpgradeFixture";
import { XInstructionBuilderView } from "@/features/x/XInstructionBuilder";
import { FIXTURE_NOW_MS, WINDOWS } from "../surface/fixtures";

const DEV = {
  title: "X rail",
  intro: "The X-Predict wallet card in every link state, the claim ticket, and a receipt of every status — from canned data. No wallet, no store, no X app.",
} as const;

const EXECUTOR = "0x00000000000000000000000000000000000000e0";
const OTHER = "0x1111111111111111111111111111111111111111";
const noop = async () => undefined;

function status(over: Partial<XStatus>): XStatus {
  return { configured: true, missing: [], storeConfigured: true, signedIn: false, session: null, binding: null, executor: EXECUTOR, handle: "@masayume_app", ...over };
}

function link(over: Partial<XLink> & { status: XStatus }): XLink {
  return { loading: false, busy: "", error: "", ok: "", needsLink: false, walletMismatch: false, sessionMatchesBinding: false, refresh: noop, link: noop, unlink: noop, startUrl: (r) => `/api/x/start?return=${r}`, setOk: () => undefined, setError: () => undefined, ...over };
}

const GRANT: VaultGrant = {
  grantId: 3n, owner: WALLET.toLowerCase() as VaultGrant["owner"], actor: EXECUTOR as VaultGrant["actor"], kind: "executor", revoked: false,
  expiresAtSec: X_FIXTURE_NOW_SEC + 86_400 * 20, spentDay: 0, spentTodayBase: 0n, openPositions: 1,
  caps: xGrantCaps(), budgetBase: 7_250_000n,
};

function grant(over: Partial<XGrantState>): XGrantState {
  return { deployed: true, decimals: 6, grant: null, balanceBase: 0n, availableBase: 12_000_000n, readable: true, pendingUpdate: null,
    permission: (executor) => over.readable === false || over.deployed === false ? "unavailable" : xPermissionState(over.grant ?? null, executor, X_FIXTURE_NOW_SEC),
    busy: "", error: "", ok: "", fund: noop, cashOut: noop, update: noop, keepReturnedFunds: () => undefined, clear: () => undefined, ...over };
}

const BINDING = { authorId: "1234567890", handle: "abu_builds", wallet: WALLET.toLowerCase(), since: X_FIXTURE_NOW_SEC * 1000 - 86_400_000 };
const SESSION = { authorId: "1234567890", handle: "abu_builds" };

const CASES: Array<{ title: string; address: string | null; link: XLink; grant: XGrantState }> = [
  { title: "Not configured (no X app on this deployment)", address: WALLET, link: link({ status: status({ configured: false, missing: ["X_API_KEY", "X_API_KEY_SECRET", "X_SESSION_SECRET"], executor: null }) }), grant: grant({}) },
  { title: "Connected wallet, X not signed in", address: WALLET, link: link({ status: status({}) }), grant: grant({}) },
  { title: "Signed in, one more step to link", address: WALLET, link: link({ status: status({ signedIn: true, session: SESSION }), needsLink: true }), grant: grant({}) },
  { title: "Linked and funded (the executor grant holds the balance)", address: WALLET, link: link({ status: status({ signedIn: true, session: SESSION, binding: BINDING }), sessionMatchesBinding: true }), grant: grant({ grant: GRANT, balanceBase: GRANT.budgetBase }) },
  { title: "Expired permission keeps the X balance visible", address: WALLET, link: link({ status: status({ binding: BINDING }) }), grant: grant({ grant: { ...GRANT, expiresAtSec: 1 }, balanceBase: GRANT.budgetBase }) },
  { title: "Unavailable reading does not enable funding", address: WALLET, link: link({ status: status({ binding: BINDING }) }), grant: grant({ grant: GRANT, balanceBase: GRANT.budgetBase, readable: false }) },
  { title: "Wrong wallet for this X account", address: OTHER, link: link({ status: status({ signedIn: true, session: SESSION, binding: BINDING }), walletMismatch: true }), grant: grant({}) },
  { title: "Vault not deployed on this network", address: WALLET, link: link({ status: status({ binding: BINDING }) }), grant: grant({ deployed: false, balanceBase: null }) },
];

const RECEIPTS: XReceipt[] = (["filled", "nothing-filled", "refused", "submitted", "reverted", "unknown"] as const).map((s, i) => ({
  mentionId: `18${i}`, authorId: SESSION.authorId, handle: SESSION.handle, wallet: WALLET.toLowerCase(), grantId: "3", marketId: `0x${"11".repeat(32)}`,
  side: i % 2 ? "down" : "up", stakeBase: "5000000", status: s,
  reason: s === "refused" ? "Review your trading permission and spending limits." : s === "unknown" ? "The transaction needs checking." : null,
  refusalCode: s === "refused" ? "permission-denied" : null,
  txHash: s === "filled" || s === "reverted" ? `0x${"9f".repeat(32)}` : null, instruction: "@masayume_app btc up 5 15m", atMs: X_FIXTURE_NOW_SEC * 1000 - i * 600_000,
}));
RECEIPTS.push(
  { ...RECEIPTS[2]!, mentionId: "190", refusalCode: "window-entry-closed", asset: "BTC", intervalSec: 900, entryClosesAtSec: X_FIXTURE_NOW_SEC - 30 },
  { ...RECEIPTS[2]!, mentionId: "191", refusalCode: "instruction-invalid", parseRefusal: "no-cadence", instruction: "@masayume_app BTC long 5" },
);

export default function DevXPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-8 px-gutter py-8">
      <SectionHeader index="00" title={DEV.title} />
      <p className="type-body text-ink-secondary">{DEV.intro}</p>
      <XUpgradeFixture />
      <section className="xt xt-page rounded-lg p-6">
        <h2 className="type-body-strong text-ink">Instruction builder — fixed market fixtures</h2>
        <XInstructionBuilderView enabled balanceBase={55_000_000n} decimals={6} symbol="tUSDC" markets={WINDOWS} unavailable={false} nowMs={FIXTURE_NOW_MS} />
      </section>
      {CASES.map((c) => (
        <section key={c.title} className="flex flex-col gap-3">
          <h2 className="type-body-strong text-ink">{c.title}</h2>
          <XWalletCardView address={c.address} link={c.link} grant={c.grant} />
        </section>
      ))}
      <section className="flex flex-col gap-3">
        <h2 className="type-body-strong text-ink">Claim ticket — masked, known, claimed</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <ClaimReceiptCard amount={null} handle={null} done={false} symbol="tUSDC" />
          <ClaimReceiptCard amount="42.50" handle="abu_builds" done={false} symbol="tUSDC" />
          <ClaimReceiptCard amount="42.50" handle="abu_builds" done symbol="tUSDC" />
        </div>
      </section>
      <section className="xt xt-page rounded-lg p-6">
        <XReceiptsList receipts={RECEIPTS} configured decimals={6} symbol="tUSDC" />
      </section>
    </div>
  );
}
