import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodePriceUpdateV2, printDiff } from "./decode";
import { parseArchivedUpdate, preflightRefusal } from "./hermes";

const vectors = new URL("../../../../anchor/tests/vectors/prints/", import.meta.url);
const account = Buffer.from(readFileSync(new URL("pyth-tsla-1789156800.account.b64", vectors), "utf8").trim(), "base64");
const parsed = JSON.parse(readFileSync(new URL("pyth-tsla-1789156800.json", vectors), "utf8")) as {
  T: number;
  feedId: string;
  price: number;
  conf: number;
  expo: number;
  publishTime: number;
  prevPublishTime: number;
  normalizedPrice: number;
};

describe("decodePriceUpdateV2", () => {
  it("decodes the D-021 devnet-fork account to Hermes' integers, Full, at T", () => {
    const update = decodePriceUpdateV2(new Uint8Array(account));
    expect(account.length).toBe(134);
    expect(update.verification).toEqual({ level: "full" });
    expect(update.feedIdHex).toBe(parsed.feedId);
    expect(update.price).toBe(BigInt(parsed.price));
    expect(update.conf).toBe(BigInt(parsed.conf));
    expect(update.exponent).toBe(parsed.expo);
    expect(update.publishTimeSec).toBe(parsed.T);
    expect(update.prevPublishTimeSec).toBe(parsed.prevPublishTime);
    expect(update.postedSlot > 0n).toBe(true);
    expect(printDiff(update.price, update.exponent, BigInt(parsed.normalizedPrice))).toBe(0n);
  });

  it("refuses a foreign discriminator and reads a Partial level one byte later", () => {
    const foreign = new Uint8Array(account);
    foreign[0] = 0;
    expect(() => decodePriceUpdateV2(foreign)).toThrow(/discriminator/);
    const partial = new Uint8Array(134);
    partial.set(account.subarray(0, 40));
    partial[40] = 0;
    partial[41] = 13;
    partial.set(account.subarray(41, 133), 42);
    const update = decodePriceUpdateV2(partial);
    expect(update.verification).toEqual({ level: "partial", numSignatures: 13 });
    expect(update.price).toBe(BigInt(parsed.price));
    expect(update.publishTimeSec).toBe(parsed.T);
  });
});

describe("printDiff and the preflight", () => {
  it("scales without rounding in both directions", () => {
    expect(printDiff(36_547_600n, -5, 36_547_600_000n)).toBe(0n);
    expect(printDiff(36_547_601n, -5, 36_547_600_000n)).toBe(1_000n);
    expect(printDiff(3_654_760_000_001n, -10, 36_547_600_000n)).toBe(1n);
  });

  it("refuses a wrong publish time or price before anything is sent", () => {
    const update = parseArchivedUpdate(
      JSON.stringify({ binary: { encoding: "base64", data: ["AA=="] }, parsed: [{ id: parsed.feedId, price: { price: "36547600", conf: "6068", expo: -5, publish_time: parsed.T } }] }),
    );
    expect(preflightRefusal(update, parsed.feedId, parsed.T, 36_547_600_000n)).toBeNull();
    expect(preflightRefusal(update, parsed.feedId, parsed.T + 300, 36_547_600_000n)).toEqual({ kind: "publish-time", publishTimeSec: parsed.T });
    expect(preflightRefusal(update, parsed.feedId, parsed.T, 36_547_700_000n)).toEqual({ kind: "price", diff: -100_000n });
    expect(preflightRefusal(update, "00".repeat(32), parsed.T, 36_547_600_000n)).toEqual({ kind: "feed-missing" });
  });
});
