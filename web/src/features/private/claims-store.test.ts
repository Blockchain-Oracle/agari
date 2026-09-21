import { PRIVATE_BACKUP_KIND, type PrivateTicket } from "@agari/core/private";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signedTickets } from "@/app/dev/private/fixtures";
import { exportPrivateClaims, importPrivateClaims, loadPrivateTickets, savePrivateTickets } from "./claims-store";

/**
 * The claims list is the only record of money the desk owes: nothing on chain names the owner of a private slot,
 * so a browser that loses this list loses the position. Restore is therefore the one path that has to hold up
 * against a file someone edited, an old backup, and a laptop that is not the one that opened the bet.
 */
const KEY = "agari.private.claims";

/** The store reads `window.localStorage` behind a guard; the test project runs on node, so supply one. */
function installStorage(): void {
  const map = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  };
}

const slotsOf = (tickets: readonly PrivateTicket[]) => tickets.map((t) => t.claim.slotId).sort();
const backupOf = (claims: readonly unknown[]) => JSON.stringify({ kind: PRIVATE_BACKUP_KIND, version: 1, exportedAt: Date.now(), claims });

let fixtures: PrivateTicket[];

beforeEach(async () => {
  installStorage();
  fixtures = await signedTickets();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("private claims backup and restore", () => {
  it("brings every claim back into a browser that has none", () => {
    savePrivateTickets(fixtures);
    const file = exportPrivateClaims();
    (globalThis as { window: { localStorage: { removeItem: (k: string) => void } } }).window.localStorage.removeItem(KEY);
    expect(loadPrivateTickets()).toHaveLength(0);

    expect(importPrivateClaims(file)).toEqual({ added: fixtures.length, skipped: 0 });
    expect(slotsOf(loadPrivateTickets())).toEqual(slotsOf(fixtures));
  });

  it("keeps the claim this browser holds, so an old backup cannot reopen a cashed-out position", () => {
    const credited = fixtures.find((t) => t.status === "credited");
    if (!credited) throw new Error("the fixtures no longer carry a credited claim");
    savePrivateTickets([credited]);

    // The same slot as it looked before the cash-out: open, with no payout recorded.
    const stale = { ...credited, status: "open", payoutBase: undefined, creditedAtMs: undefined };
    expect(importPrivateClaims(backupOf([stale]))).toEqual({ added: 0, skipped: 0 });

    const [held] = loadPrivateTickets();
    expect(held?.status).toBe("credited");
    expect(held?.payoutBase).toBe(credited.payoutBase);
  });

  it("skips a row someone edited and keeps the rest of the file", () => {
    const [good, ...others] = fixtures;
    if (!good || others.length === 0) throw new Error("the fixtures no longer carry two claims");
    const edited = { ...others[0], claim: { ...others[0]?.claim, stakeBase: "not a number" } };

    expect(importPrivateClaims(backupOf([good, edited]))).toEqual({ added: 1, skipped: 1 });
    expect(slotsOf(loadPrivateTickets())).toEqual([good.claim.slotId]);
  });

  it("refuses a file that is not a claims backup rather than emptying the list", () => {
    savePrivateTickets(fixtures);
    expect(() => importPrivateClaims(JSON.stringify({ kind: "something.else", claims: [] }))).toThrow(/not an Agari claims file/);
    expect(loadPrivateTickets()).toHaveLength(fixtures.length);
  });

  it("exports only the owner asked for, so one person's backup cannot carry another's claims", () => {
    const [mine, theirs] = fixtures;
    if (!mine || !theirs) throw new Error("the fixtures no longer carry two claims");
    const other = { ...theirs, claim: { ...theirs.claim, owner: `${theirs.claim.owner.slice(0, -1)}${theirs.claim.owner.endsWith("1") ? "2" : "1"}` } } as PrivateTicket;
    savePrivateTickets([mine, other]);

    const file = JSON.parse(exportPrivateClaims(mine.claim.owner)) as { claims: PrivateTicket[] };
    expect(slotsOf(file.claims)).toEqual([mine.claim.slotId]);
  });
});
