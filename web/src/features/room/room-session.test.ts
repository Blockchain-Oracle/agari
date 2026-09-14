import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeBase58, toAddress, toMarketId } from "@agari/core/types";
import { ROOM_TOKEN_TTL_MS } from "./protocol";
import { clearRoomToken, readRoomToken, writeRoomToken } from "./room-session";

/** Valid, distinct base58 ids: every byte `n` (the `@agari/core` testing helpers' method). */
const filled = (n: number) => encodeBase58(new Uint8Array(32).fill(n));
const ADDRESS = toAddress(filled(0xd3));
const MARKET = toMarketId(filled(0x45));
const OTHER_MARKET = toMarketId(filled(0x46));

/** A `localStorage` that lives for one test, on a `window` that lives for one test. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    size: () => map.size,
  };
}

describe("room-session", () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
    (globalThis as { window?: unknown }).window = { localStorage: storage };
  });
  afterEach(() => {
    clearRoomToken(ADDRESS, MARKET);
    delete (globalThis as { window?: unknown }).window;
  });

  it("remembers a token for the wallet and market it was minted for, and for nobody else", () => {
    writeRoomToken(ADDRESS, MARKET, "tok-1", 1_000_000);
    expect(readRoomToken(ADDRESS, MARKET, 1_000_000 + 60_000)).toBe("tok-1");
    // base58 is case-sensitive: a re-cased wallet is another key, and another market is another Room
    expect(readRoomToken(ADDRESS.toLowerCase(), MARKET, 1_000_000 + 60_000)).toBeNull();
    expect(readRoomToken(ADDRESS, OTHER_MARKET, 1_000_000 + 60_000)).toBeNull();
    expect(storage.size()).toBe(1);
  });

  it("drops the token a little before the server's hour is up, and never presents it after", () => {
    writeRoomToken(ADDRESS, MARKET, "tok-2", 0);
    expect(readRoomToken(ADDRESS, MARKET, ROOM_TOKEN_TTL_MS - 60_000)).toBe("tok-2");
    expect(readRoomToken(ADDRESS, MARKET, ROOM_TOKEN_TTL_MS)).toBeNull();
    // the aged token is gone from storage too, so a later read cannot resurrect it
    expect(storage.size()).toBe(0);
  });

  it("survives the in-memory copy being lost, by reading storage back", () => {
    storage.setItem(`agari:room:${ADDRESS}:${MARKET}`, JSON.stringify({ token: "tok-3", expiresAtMs: 5_000_000 }));
    expect(readRoomToken(ADDRESS, MARKET, 4_000_000)).toBe("tok-3");
  });

  it("forgets on clear", () => {
    writeRoomToken(ADDRESS, MARKET, "tok-4", 0);
    clearRoomToken(ADDRESS, MARKET);
    expect(readRoomToken(ADDRESS, MARKET, 1)).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it("ignores a storage that refuses, and still serves the tab from memory", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    };
    writeRoomToken(ADDRESS, MARKET, "tok-5", 0);
    expect(readRoomToken(ADDRESS, MARKET, 1)).toBe("tok-5");
  });
});
