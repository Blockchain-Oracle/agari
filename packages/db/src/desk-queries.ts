/**
 * `deskQueries(db)`: the one object the web routes (C5) and the desk runner (C4) share for the desk's tables. The
 * contract names C5 codes against are the union of the four factories; the runner's extra queries ride alongside.
 * Money crosses as decimal strings, seconds as numbers, never a bigint or a Date.
 */
import type { Db } from "./client";
import { deskCoreQueries } from "./desk";
import { deskApprovalQueries } from "./desk-approvals";
import { deskGradeQueries } from "./desk-grades";
import { deskRecordQueries } from "./desk-records";

export function deskQueries(db: Db) {
  return { ...deskCoreQueries(db), ...deskRecordQueries(db), ...deskApprovalQueries(db), ...deskGradeQueries(db) };
}

export type DeskQueries = ReturnType<typeof deskQueries>;
