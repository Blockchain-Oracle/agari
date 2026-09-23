/**
 * Optional Postgres for social records only — chain truth is never stored here.
 *
 * Every export is `null`-shaped when `DATABASE_URL` is absent, so the app runs
 * correctly with no database and each surface says plainly that it is not
 * connected rather than showing an empty room that nobody has read.
 */
export const DB_PACKAGE = "@agari/db" as const;

export * from "./arcade";
export * from "./bettors";
export * from "./client";
export * from "./comments";
export * from "./decks";
export * from "./games";
export * from "./lucky";
export * from "./migrate";
export * from "./schema";
export * from "./takes";
export * from "./x";
export * from "./x-reply-delivery";
export * from "./x-health";
export * from "./strategies";
export * from "./strategy-memory";
export * from "./strategy-decisions";
export * from "./strategy-attempts";
export * from "./faucet";
export * from "./print-archive";
export * from "./print-archive-read";
export * from "./index-store";
export * from "./proofs";
export * from "./sponsor";
export * from "./schema-sponsor";
export * from "./follows";
// S21 (D-126): the desk's records, paper ledger, approvals and grades.
export * from "./schema-desk";
export * from "./desk";
export * from "./desk-records";
export * from "./desk-approvals";
export * from "./desk-grades";
export * from "./desk-marks";
export * from "./desk-series";
export * from "./desk-queries";
