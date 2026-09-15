import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RawTransaction } from "./decode";
import { decodeVaultTransactionEvents } from "./vault-decode";

const fixture = (name: string) => (JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")) as { transaction: RawTransaction }).transaction;
const tap = fixture("vault-tap-sponsored");
const crank = fixture("vault-crank-settle");

describe("decodeVaultTransactionEvents on real fork transactions", () => {
  it("decodes the Executed of a sponsored session-key tap, JSON-safe", async () => {
    const { events, failed } = await decodeVaultTransactionEvents(tap);
    expect(failed).toBe(false);
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event!.name).toBe("Executed");
    expect(event!.owner).toBe(event!.data.owner);
    expect(event!.market).toBe(event!.data.market);
    // The actor is the session key, not the owner, and the grant that paid is named.
    expect(event!.data.actor).not.toBe(event!.data.owner);
    expect(typeof event!.data.grantId).toBe("string");
    expect(BigInt(event!.data.grantId as string)).toBeGreaterThan(0n);
    expect(event!.data.isBuy).toBe(true);
    expect(BigInt(event!.data.cashDelta as string)).toBeGreaterThan(0n);
    expect(BigInt(event!.data.lotsDelta as string)).toBeGreaterThan(0n);
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });

  it("decodes the Settled of a third-party crank, with the payout and both sides redeemed", async () => {
    const { events } = await decodeVaultTransactionEvents(crank);
    const settled = events.find((e) => e.name === "Settled");
    expect(settled).toBeDefined();
    expect(settled!.owner).toBe(settled!.data.owner);
    // The cranker is whoever sent it; the payout lands on the owner either way.
    expect(settled!.data.by).not.toBe(settled!.data.owner);
    expect(BigInt(settled!.data.payout as string)).toBeGreaterThan(0n);
    expect(BigInt(settled!.data.yesRedeemed as string) + BigInt(settled!.data.noRedeemed as string)).toBeGreaterThan(0n);
  });

  it("yields nothing for a failed transaction and nothing for another program's events", async () => {
    expect((await decodeVaultTransactionEvents({ ...tap, meta: { ...tap.meta!, err: { InstructionError: [1, { Custom: 7108 }] } } })).events).toEqual([]);
    const engineOnly = { ...tap, meta: { ...tap.meta!, innerInstructions: [] } };
    expect((await decodeVaultTransactionEvents(engineOnly)).events).toEqual([]);
  });
});
