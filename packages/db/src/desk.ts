/**
 * Desk rows, mandates, wakes, the paper ledger, snapshots, hourly marks and the event log (S21, `schema-desk.ts`).
 * Every function takes the connection it is given, so a route and the runner share one factory (`desk-queries.ts`).
 * Money crosses as decimal strings; seconds as numbers.
 */
import type { Db } from "./client";
import { storageKey } from "./keys";
import { ensureSchema } from "./migrate";

export type DeskCluster = "mainnet-beta" | "devnet" | "localnet";
export type DeskModeName = "practice" | "ask_first" | "on_its_own";
export type DeskStateName = "active" | "paused" | "stopped_by_loss" | "needs_attention" | "closed";
export type WakeTrigger = "hour" | "deposit" | "move" | "check_now" | "test_read" | "checkpoint" | "owner_request";
export type WakeStatus = "requested" | "running" | "completed" | "failed" | "skipped";

export interface DeskRow {
  id: string;
  address: string | null;
  owner: string;
  operator: string | null;
  cluster: DeskCluster;
  mode: DeskModeName;
  state: DeskStateName;
  stateReason: string | null;
  chainSeq: number;
  chainHead: string;
  mandateVersion: number;
  drawdownBaselineE6: string | null;
  lossBreaches: number;
  practiceChecks: number;
  recordOpenedAtSec: number | null;
  sharePublic: boolean;
  createdAtSec: number;
  updatedAtSec: number;
}

export interface MandateRow {
  version: number;
  body: Record<string, unknown>;
  fingerprint: string;
  signer: string;
  signature: string;
  appliedAtSec: number;
}

export interface WakeRow {
  id: string;
  deskId: string;
  scheduledForSec: number;
  trigger: WakeTrigger;
  status: WakeStatus;
  requestedBy: string | null;
}

export interface SnapshotHolding {
  symbol: string;
  mint: string;
  raw: string;
  priceE8: string;
  valueE6: string;
  weightBps: number;
  targetBps: number;
  driftBps: number;
  premiumBps: number | null;
  /** How old the price was when the snapshot was taken. */
  priceAgeSec: number | null;
  paused: boolean;
  frozen: boolean;
}

export interface SnapshotRow {
  /** `atSec` and `takenAtSec` are the same second; `cashE6` and `usdcE6` the same cash (C5 reads the first of each pair). */
  atSec: number;
  takenAtSec: number;
  totalE6: string;
  cashE6: string;
  usdcE6: string;
  /** The loss-limit baseline as the desk row carries it now; null until the first fully priced valuation. */
  baselineE6: string | null;
  holdings: SnapshotHolding[];
  unpriced: { symbol: string; mint: string; raw: string; why: string }[];
}

export interface OwnerRequestRow {
  id: string;
  deskId: string;
  kind: "sell_all" | "close";
  signer: string;
  requestedAtSec: number;
  finishedAtSec: number | null;
  note: string | null;
}

export interface PaperRow {
  cashE6: string;
  positions: Record<string, string>;
  updatedAtSec: number;
}

export interface PriceMarkRow {
  symbol: string;
  atSec: number;
  tokenE8: string;
  markE8: string;
}

export class DeskAlreadyExistsError extends Error {
  constructor(readonly deskId: string) {
    super("this owner already has a desk on this network");
    this.name = "DeskAlreadyExistsError";
  }
}

interface RawDesk {
  id: string;
  address: string | null;
  owner: string;
  operator: string | null;
  cluster: DeskCluster;
  mode: DeskModeName;
  state: DeskStateName;
  state_reason: string | null;
  chain_seq: string;
  chain_head: string;
  mandate_version: number;
  drawdown_baseline_e6: string | null;
  loss_breaches: number;
  practice_checks: number;
  record_opened_at_sec: string | null;
  share_public: boolean;
  created_at_sec: string;
  updated_at_sec: string;
}

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

const toDesk = (r: RawDesk): DeskRow => ({
  id: r.id,
  address: r.address,
  owner: r.owner,
  operator: r.operator,
  cluster: r.cluster,
  mode: r.mode,
  state: r.state,
  stateReason: r.state_reason,
  chainSeq: Number(r.chain_seq),
  chainHead: r.chain_head,
  mandateVersion: r.mandate_version,
  drawdownBaselineE6: r.drawdown_baseline_e6,
  lossBreaches: r.loss_breaches,
  practiceChecks: r.practice_checks,
  recordOpenedAtSec: num(r.record_opened_at_sec),
  sharePublic: r.share_public,
  createdAtSec: Number(r.created_at_sec),
  updatedAtSec: Number(r.updated_at_sec),
});

const toWake = (r: { id: string; desk_id: string; scheduled_for_sec: string; trigger: WakeTrigger; status: WakeStatus; requested_by: string | null }): WakeRow => ({
  id: r.id,
  deskId: r.desk_id,
  scheduledForSec: Number(r.scheduled_for_sec),
  trigger: r.trigger,
  status: r.status,
  requestedBy: r.requested_by,
});

export function deskCoreQueries(db: Db) {
  const ready = () => ensureSchema();
  const addEvent = async (e: { deskId: string; kind: string; actor: string; detail?: Record<string, unknown> | null; atSec: number }) => {
    await ready();
    await db`INSERT INTO desk_events (desk_id, kind, actor, detail, at_sec) VALUES (${e.deskId}, ${e.kind}, ${e.actor}, ${db.json((e.detail ?? null) as never)}, ${e.atSec})`;
  };

  return {
    addEvent,
    async getDeskByOwner(cluster: DeskCluster, owner: string): Promise<DeskRow | null> {
      await ready();
      const rows = await db<RawDesk[]>`SELECT * FROM desks WHERE cluster = ${cluster} AND owner = ${storageKey(owner)}`;
      return rows[0] ? toDesk(rows[0]) : null;
    },
    async getDeskById(id: string): Promise<DeskRow | null> {
      await ready();
      const rows = await db<RawDesk[]>`SELECT * FROM desks WHERE id = ${id}::uuid`;
      return rows[0] ? toDesk(rows[0]) : null;
    },
    async listDesks(filter: { cluster?: DeskCluster; state?: DeskStateName; mode?: DeskModeName } = {}): Promise<DeskRow[]> {
      await ready();
      const rows = await db<RawDesk[]>`SELECT * FROM desks
        WHERE (${filter.cluster ?? null}::text IS NULL OR cluster = ${filter.cluster ?? null})
          AND (${filter.state ?? null}::text IS NULL OR state = ${filter.state ?? null})
          AND (${filter.mode ?? null}::text IS NULL OR mode = ${filter.mode ?? null})
        ORDER BY created_at_sec ASC`;
      return rows.map(toDesk);
    },
    /** A practice desk with its first mandate and its paper ledger, in one transaction. */
    async createPracticeDesk(i: { owner: string; cluster: DeskCluster; mandateBody: Record<string, unknown>; fingerprint: string; signer: string; signature: string; cashE6?: string; nowSec?: number }): Promise<DeskRow> {
      await ready();
      const nowSec = i.nowSec ?? Math.floor(Date.now() / 1000);
      const owner = storageKey(i.owner);
      return db.begin(async (tx) => {
        const existing = await tx<{ id: string }[]>`SELECT id FROM desks WHERE cluster = ${i.cluster} AND owner = ${owner}`;
        if (existing[0]) throw new DeskAlreadyExistsError(existing[0].id);
        const [desk] = await tx<RawDesk[]>`INSERT INTO desks (owner, cluster, mode, state, mandate_version, created_at_sec, updated_at_sec)
          VALUES (${owner}, ${i.cluster}, 'practice', 'active', 1, ${nowSec}, ${nowSec}) RETURNING *`;
        if (!desk) throw new Error("the desk was not inserted");
        await tx`INSERT INTO desk_mandates (desk_id, version, body, fingerprint, signer, signature, applied_at_sec)
          VALUES (${desk.id}::uuid, 1, ${tx.json(i.mandateBody as never)}, ${storageKey(i.fingerprint)}, ${storageKey(i.signer)}, ${i.signature}, ${nowSec})`;
        await tx`INSERT INTO desk_paper (desk_id, cash_e6, positions, updated_at_sec) VALUES (${desk.id}::uuid, ${i.cashE6 ?? "1000000000"}, ${tx.json({})}, ${nowSec})`;
        await tx`INSERT INTO desk_events (desk_id, kind, actor, detail, at_sec) VALUES (${desk.id}::uuid, 'created', 'owner', ${tx.json({ mode: "practice", cashE6: i.cashE6 ?? "1000000000" })}, ${nowSec})`;
        return toDesk(desk);
      });
    },
    /** Go live: the desk now has a PDA and an operator; the chain position is read afresh by the runner's reconcile. */
    async attachLiveDesk(i: { deskId: string; address: string; operator: string; mode: Exclude<DeskModeName, "practice">; nowSec?: number }): Promise<void> {
      await ready();
      const nowSec = i.nowSec ?? Math.floor(Date.now() / 1000);
      await db`UPDATE desks SET address = ${storageKey(i.address)}, operator = ${storageKey(i.operator)}, mode = ${i.mode}, state = 'active', state_reason = NULL,
        chain_seq = 0, chain_head = '0x0000000000000000000000000000000000000000000000000000000000000000', drawdown_baseline_e6 = NULL, loss_breaches = 0, updated_at_sec = ${nowSec}
        WHERE id = ${i.deskId}::uuid`;
      await addEvent({ deskId: i.deskId, kind: "went_live", actor: "owner", detail: { address: i.address, mode: i.mode }, atSec: nowSec });
    },
    async setDeskMode(i: { deskId: string; mode: DeskModeName; nowSec?: number }): Promise<void> {
      await ready();
      const nowSec = i.nowSec ?? Math.floor(Date.now() / 1000);
      await db`UPDATE desks SET mode = ${i.mode}, updated_at_sec = ${nowSec} WHERE id = ${i.deskId}::uuid`;
      await addEvent({ deskId: i.deskId, kind: "mode_set", actor: "owner", detail: { mode: i.mode }, atSec: nowSec });
    },
    async setDeskState(i: { deskId: string; state: DeskStateName; reason: string | null; actor?: string; nowSec?: number }): Promise<void> {
      await ready();
      const nowSec = i.nowSec ?? Math.floor(Date.now() / 1000);
      await db`UPDATE desks SET state = ${i.state}, state_reason = ${i.reason}, updated_at_sec = ${nowSec} WHERE id = ${i.deskId}::uuid`;
      await addEvent({ deskId: i.deskId, kind: "state_set", actor: i.actor ?? "owner", detail: { state: i.state, reason: i.reason }, atSec: nowSec });
    },
    async setSharePublic(i: { deskId: string; on: boolean; nowSec?: number }): Promise<void> {
      await ready();
      await db`UPDATE desks SET share_public = ${i.on}, updated_at_sec = ${i.nowSec ?? Math.floor(Date.now() / 1000)} WHERE id = ${i.deskId}::uuid`;
    },
    async markRecordOpened(i: { deskId: string; nowSec: number }): Promise<void> {
      await ready();
      await db`UPDATE desks SET record_opened_at_sec = COALESCE(record_opened_at_sec, ${i.nowSec}), updated_at_sec = ${i.nowSec} WHERE id = ${i.deskId}::uuid`;
    },
    /** A new mandate version; the desk's `mandate_version` follows it. Returns the version. */
    async applyMandate(i: { deskId: string; body: Record<string, unknown>; fingerprint: string; signer: string; signature: string; nowSec: number }): Promise<number> {
      await ready();
      return db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${i.deskId}))`;
        const [last] = await tx<{ version: number }[]>`SELECT COALESCE(MAX(version), 0) AS version FROM desk_mandates WHERE desk_id = ${i.deskId}::uuid`;
        const version = (last?.version ?? 0) + 1;
        await tx`INSERT INTO desk_mandates (desk_id, version, body, fingerprint, signer, signature, applied_at_sec)
          VALUES (${i.deskId}::uuid, ${version}, ${tx.json(i.body as never)}, ${storageKey(i.fingerprint)}, ${storageKey(i.signer)}, ${i.signature}, ${i.nowSec})`;
        await tx`UPDATE desks SET mandate_version = ${version}, updated_at_sec = ${i.nowSec} WHERE id = ${i.deskId}::uuid`;
        await tx`INSERT INTO desk_events (desk_id, kind, actor, detail, at_sec) VALUES (${i.deskId}::uuid, 'mandate_applied', 'owner', ${tx.json({ version, fingerprint: i.fingerprint })}, ${i.nowSec})`;
        return version;
      });
    },
    async currentMandate(deskId: string): Promise<MandateRow | null> {
      await ready();
      const rows = await db<{ version: number; body: Record<string, unknown>; fingerprint: string; signer: string; signature: string; applied_at_sec: string }[]>`
        SELECT version, body, fingerprint, signer, signature, applied_at_sec FROM desk_mandates WHERE desk_id = ${deskId}::uuid ORDER BY version DESC LIMIT 1`;
      const r = rows[0];
      return r ? { version: r.version, body: r.body, fingerprint: r.fingerprint, signer: r.signer, signature: r.signature, appliedAtSec: Number(r.applied_at_sec) } : null;
    },
    async setChainPosition(i: { deskId: string; chainSeq: number; chainHead: string; nowSec: number }): Promise<void> {
      await ready();
      await db`UPDATE desks SET chain_seq = ${i.chainSeq}, chain_head = ${storageKey(i.chainHead)}, updated_at_sec = ${i.nowSec} WHERE id = ${i.deskId}::uuid`;
    },
    async setDrawdownBaseline(i: { deskId: string; baselineE6: string | null; nowSec: number }): Promise<void> {
      await ready();
      await db`UPDATE desks SET drawdown_baseline_e6 = ${i.baselineE6}, updated_at_sec = ${i.nowSec} WHERE id = ${i.deskId}::uuid`;
    },
    /** Consecutive checks below the loss limit: +1 on a breach, back to 0 otherwise. Returns the count. */
    async recordLossBreach(i: { deskId: string; breached: boolean; nowSec: number }): Promise<number> {
      await ready();
      const rows = await db<{ loss_breaches: number }[]>`UPDATE desks SET loss_breaches = ${i.breached ? db`loss_breaches + 1` : db`0`}, updated_at_sec = ${i.nowSec} WHERE id = ${i.deskId}::uuid RETURNING loss_breaches`;
      return rows[0]?.loss_breaches ?? 0;
    },
    async bumpPracticeChecks(i: { deskId: string; nowSec: number }): Promise<number> {
      await ready();
      const rows = await db<{ practice_checks: number }[]>`UPDATE desks SET practice_checks = practice_checks + 1, updated_at_sec = ${i.nowSec} WHERE id = ${i.deskId}::uuid RETURNING practice_checks`;
      return rows[0]?.practice_checks ?? 0;
    },
    /** Claims (desk, slot, trigger): the row is the claim. Null when another pass already holds it. */
    async claimWake(i: { deskId: string; scheduledForSec: number; trigger: WakeTrigger; nowSec: number }): Promise<WakeRow | null> {
      await ready();
      const rows = await db<{ id: string; desk_id: string; scheduled_for_sec: string; trigger: WakeTrigger; status: WakeStatus; requested_by: string | null }[]>`
        INSERT INTO desk_wakes (desk_id, scheduled_for_sec, trigger, status, started_at_sec) VALUES (${i.deskId}::uuid, ${i.scheduledForSec}, ${i.trigger}, 'running', ${i.nowSec})
        ON CONFLICT (desk_id, scheduled_for_sec, trigger) DO NOTHING RETURNING id, desk_id, scheduled_for_sec, trigger, status, requested_by`;
      return rows[0] ? toWake(rows[0]) : null;
    },
    /** The oldest check-now request nobody has run yet, moved to running. */
    async takeRequestedWake(i: { deskId: string; nowSec: number }): Promise<WakeRow | null> {
      await ready();
      const rows = await db<{ id: string; desk_id: string; scheduled_for_sec: string; trigger: WakeTrigger; status: WakeStatus; requested_by: string | null }[]>`
        UPDATE desk_wakes SET status = 'running', started_at_sec = ${i.nowSec}
        WHERE id = (SELECT id FROM desk_wakes WHERE desk_id = ${i.deskId}::uuid AND status = 'requested' ORDER BY scheduled_for_sec ASC LIMIT 1)
        RETURNING id, desk_id, scheduled_for_sec, trigger, status, requested_by`;
      return rows[0] ? toWake(rows[0]) : null;
    },
    async finishWake(i: { wakeId: string; status: Exclude<WakeStatus, "requested" | "running">; error?: string | null; nowSec: number }): Promise<void> {
      await ready();
      await db`UPDATE desk_wakes SET status = ${i.status}, error = ${i.error ?? null}, finished_at_sec = ${i.nowSec} WHERE id = ${i.wakeId}::uuid`;
    },
    async lastWake(deskId: string): Promise<{ scheduledForSec: number; trigger: WakeTrigger; status: WakeStatus; finishedAtSec: number | null } | null> {
      await ready();
      const rows = await db<{ scheduled_for_sec: string; trigger: WakeTrigger; status: WakeStatus; finished_at_sec: string | null }[]>`
        SELECT scheduled_for_sec, trigger, status, finished_at_sec FROM desk_wakes WHERE desk_id = ${deskId}::uuid AND status <> 'requested' ORDER BY started_at_sec DESC NULLS LAST LIMIT 1`;
      const r = rows[0];
      return r ? { scheduledForSec: Number(r.scheduled_for_sec), trigger: r.trigger, status: r.status, finishedAtSec: num(r.finished_at_sec) } : null;
    },
    async getPaper(deskId: string): Promise<PaperRow | null> {
      await ready();
      const rows = await db<{ cash_e6: string; positions: Record<string, string>; updated_at_sec: string }[]>`SELECT cash_e6, positions, updated_at_sec FROM desk_paper WHERE desk_id = ${deskId}::uuid`;
      const r = rows[0];
      return r ? { cashE6: r.cash_e6, positions: r.positions, updatedAtSec: Number(r.updated_at_sec) } : null;
    },
    async savePaper(i: { deskId: string; cashE6: string; positions: Record<string, string>; nowSec: number }, tx: Db = db): Promise<void> {
      await ready();
      await tx`INSERT INTO desk_paper (desk_id, cash_e6, positions, updated_at_sec) VALUES (${i.deskId}::uuid, ${i.cashE6}, ${tx.json(i.positions)}, ${i.nowSec})
        ON CONFLICT (desk_id) DO UPDATE SET cash_e6 = EXCLUDED.cash_e6, positions = EXCLUDED.positions, updated_at_sec = EXCLUDED.updated_at_sec`;
      await tx`UPDATE desks SET updated_at_sec = ${i.nowSec} WHERE id = ${i.deskId}::uuid`;
    },
    /** Model calls made across every desk since `sinceSec`, to warm the sliding-hour budget after a restart. */
    async modelCallsSince(sinceSec: number): Promise<number[]> {
      await ready();
      const rows = await db<{ decided_at_sec: string }[]>`SELECT decided_at_sec FROM desk_records WHERE decided_at_sec >= ${sinceSec} AND body->'timing' IS NOT NULL AND body->'timing' <> 'null'::jsonb AND (body->'timing'->>'latencyMs')::bigint > 0`;
      return rows.map((r) => Number(r.decided_at_sec));
    },
    /** A live desk the chain knows and the database does not (discovery): a row with no mandate yet, or the practice row it grows out of. */
    async registerLiveDesk(i: { owner: string; cluster: DeskCluster; address: string; operator: string; mode: DeskModeName; nowSec: number }): Promise<DeskRow> {
      await ready();
      const owner = storageKey(i.owner);
      const rows = await db<RawDesk[]>`INSERT INTO desks (address, owner, operator, cluster, mode, state, created_at_sec, updated_at_sec)
        VALUES (${storageKey(i.address)}, ${owner}, ${storageKey(i.operator)}, ${i.cluster}, ${i.mode}, 'active', ${i.nowSec}, ${i.nowSec})
        ON CONFLICT (cluster, owner) DO UPDATE SET address = EXCLUDED.address, operator = EXCLUDED.operator, mode = EXCLUDED.mode, updated_at_sec = EXCLUDED.updated_at_sec RETURNING *`;
      const row = rows[0];
      if (!row) throw new Error("the desk was not registered");
      return toDesk(row);
    },
    async saveSnapshot(i: { deskId: string; takenAtSec: number; totalE6: string; usdcE6: string; holdings: SnapshotHolding[]; unpriced: SnapshotRow["unpriced"] }): Promise<void> {
      await ready();
      await db`INSERT INTO desk_snapshots (desk_id, taken_at_sec, total_e6, usdc_e6, holdings, unpriced)
        VALUES (${i.deskId}::uuid, ${i.takenAtSec}, ${i.totalE6}, ${i.usdcE6}, ${db.json(i.holdings as never)}, ${db.json(i.unpriced as never)})`;
    },
    async latestSnapshot(deskId: string): Promise<SnapshotRow | null> {
      await ready();
      const rows = await db<{ taken_at_sec: string; total_e6: string; usdc_e6: string; holdings: SnapshotHolding[]; unpriced: SnapshotRow["unpriced"]; baseline: string | null }[]>`
        SELECT s.taken_at_sec, s.total_e6, s.usdc_e6, s.holdings, s.unpriced, d.drawdown_baseline_e6 AS baseline FROM desk_snapshots s JOIN desks d ON d.id = s.desk_id
        WHERE s.desk_id = ${deskId}::uuid ORDER BY s.taken_at_sec DESC LIMIT 1`;
      const r = rows[0];
      return r ? { atSec: Number(r.taken_at_sec), takenAtSec: Number(r.taken_at_sec), totalE6: r.total_e6, cashE6: r.usdc_e6, usdcE6: r.usdc_e6, baselineE6: r.baseline, holdings: r.holdings, unpriced: r.unpriced } : null;
    },
    /** The owner's signed standing order (sell everything, or close): a row the runner sweeps, plus a wake so it runs within the minute. */
    async requestOwnerAction(i: { deskId: string; kind: "sell_all" | "close"; signer: string; signature: string; nowSec: number }): Promise<{ ok: true; requestId: string } | { ok: false; reason: "pending" }> {
      await ready();
      return db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${i.deskId}))`;
        const open = await tx<{ id: string }[]>`SELECT id FROM desk_owner_requests WHERE desk_id = ${i.deskId}::uuid AND finished_at_sec IS NULL`;
        if (open[0]) return { ok: false as const, reason: "pending" as const };
        const [row] = await tx<{ id: string }[]>`INSERT INTO desk_owner_requests (desk_id, kind, signer, signature, requested_at_sec) VALUES (${i.deskId}::uuid, ${i.kind}, ${storageKey(i.signer)}, ${i.signature}, ${i.nowSec}) RETURNING id`;
        await tx`INSERT INTO desk_wakes (desk_id, scheduled_for_sec, trigger, status, requested_by, signature) VALUES (${i.deskId}::uuid, ${i.nowSec}, 'owner_request', 'requested', ${storageKey(i.signer)}, ${i.signature}) ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO desk_events (desk_id, kind, actor, detail, at_sec) VALUES (${i.deskId}::uuid, 'owner_request', 'owner', ${tx.json({ kind: i.kind })}, ${i.nowSec})`;
        return { ok: true as const, requestId: row?.id ?? "" };
      });
    },
    async pendingOwnerRequest(deskId: string): Promise<OwnerRequestRow | null> {
      await ready();
      const rows = await db<{ id: string; desk_id: string; kind: "sell_all" | "close"; signer: string; requested_at_sec: string; finished_at_sec: string | null; note: string | null }[]>`
        SELECT id, desk_id, kind, signer, requested_at_sec, finished_at_sec, note FROM desk_owner_requests WHERE desk_id = ${deskId}::uuid AND finished_at_sec IS NULL ORDER BY requested_at_sec ASC LIMIT 1`;
      const r = rows[0];
      return r ? { id: r.id, deskId: r.desk_id, kind: r.kind, signer: r.signer, requestedAtSec: Number(r.requested_at_sec), finishedAtSec: num(r.finished_at_sec), note: r.note } : null;
    },
    async finishOwnerRequest(i: { requestId: string; note: string; nowSec: number }): Promise<void> {
      await ready();
      await db`UPDATE desk_owner_requests SET finished_at_sec = ${i.nowSec}, note = ${i.note} WHERE id = ${i.requestId}::uuid`;
    },
    /** The desk's event log, newest first: money moving outside the desk, state and mode changes, the owner's requests. */
    async listEvents(i: { deskId: string; limit?: number; sinceSec?: number }): Promise<{ id: number; kind: string; actor: string; detail: Record<string, unknown> | null; atSec: number }[]> {
      await ready();
      const rows = await db<{ id: string; kind: string; actor: string; detail: Record<string, unknown> | null; at_sec: string }[]>`
        SELECT id, kind, actor, detail, at_sec FROM desk_events WHERE desk_id = ${i.deskId}::uuid AND at_sec >= ${i.sinceSec ?? 0} ORDER BY at_sec DESC, id DESC LIMIT ${i.limit ?? 50}`;
      return rows.map((r) => ({ id: Number(r.id), kind: r.kind, actor: r.actor, detail: r.detail, atSec: Number(r.at_sec) }));
    },
    async upsertPriceMark(m: PriceMarkRow): Promise<void> {
      await ready();
      await db`INSERT INTO desk_price_marks (symbol, at_sec, token_e8, mark_e8) VALUES (${m.symbol}, ${m.atSec}, ${m.tokenE8}, ${m.markE8}) ON CONFLICT (symbol, at_sec) DO NOTHING`;
    },
    async listPriceMarks(i: { symbol: string; fromSec: number; toSec: number }): Promise<PriceMarkRow[]> {
      await ready();
      const rows = await db<{ symbol: string; at_sec: string; token_e8: string; mark_e8: string }[]>`
        SELECT symbol, at_sec, token_e8, mark_e8 FROM desk_price_marks WHERE symbol = ${i.symbol} AND at_sec >= ${i.fromSec} AND at_sec <= ${i.toSec} ORDER BY at_sec ASC`;
      return rows.map((r) => ({ symbol: r.symbol, atSec: Number(r.at_sec), tokenE8: r.token_e8, markE8: r.mark_e8 }));
    },
    /** The first mark at or after `atSec` (the alternative's price, a day after a decision); null when none yet. */
    async priceMarkAtOrAfter(i: { symbol: string; atSec: number }): Promise<PriceMarkRow | null> {
      await ready();
      const rows = await db<{ symbol: string; at_sec: string; token_e8: string; mark_e8: string }[]>`
        SELECT symbol, at_sec, token_e8, mark_e8 FROM desk_price_marks WHERE symbol = ${i.symbol} AND at_sec >= ${i.atSec} ORDER BY at_sec ASC LIMIT 1`;
      const r = rows[0];
      return r ? { symbol: r.symbol, atSec: Number(r.at_sec), tokenE8: r.token_e8, markE8: r.mark_e8 } : null;
    },
  };
}
