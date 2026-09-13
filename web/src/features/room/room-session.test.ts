import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ROOM_TOKEN_TTL_MS } from "./protocol";
import { clearRoomToken, readRoomToken, writeRoomToken } from "./room-session";

const ADDRESS = "0xD357019E2c55375477802A047dB7bC1A77819358";
const MARKET = "0x0000000000000000000000000000000000000000000000000000000000012345";

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
    // the wallet's case does not matter; the market does
    expect(readRoomToken(ADDRESS.toLowerCase(), MARKET, 1_000_000 + 60_000)).toBe("tok-1");
    expect(readRoomToken(ADDRESS, `${MARKET.slice(0, -1)}6`, 1_000_000 + 60_000)).toBeNull();
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
    storage.setItem(`masayume:room:${ADDRESS.toLowerCase()}:${MARKET}`, JSON.stringify({ token: "tok-3", expiresAtMs: 5_000_000 }));
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
