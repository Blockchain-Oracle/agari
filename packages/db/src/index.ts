/**
 * Optional Postgres for social records only — chain truth is never stored here.
 *
 * Every export is `null`-shaped when `DATABASE_URL` is absent, so the app runs
 * correctly with no database and each surface says plainly that it is not
 * connected rather than showing an empty room that nobody has read.
 */
export const DB_PACKAGE = "@masayume/db" as const;

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
export * from "./strategy-decisions";
export * from "./strategy-attempts";
export * from "./faucet";
