import { afterEach, describe, expect, it, vi } from "vitest";

const sent: { method: string; params: unknown[] }[] = [];

vi.mock("@solana/kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@solana/kit")>()),
  createDefaultRpcTransport: () => async ({ payload }: { payload: { id: unknown; method: string; params: unknown[] } }) => {
    sent.push({ method: payload.method, params: payload.params });
    if (payload.method !== "getMultipleAccounts") return { jsonrpc: "2.0", id: payload.id, result: "other" };
    const addresses = payload.params[0] as string[];
    return { jsonrpc: "2.0", id: payload.id, result: { context: { slot: 7n }, value: addresses.map((a) => (a === "missing" ? null : { data: [a, "base64"] })) } };
  },
}));

const { pacedRpcTransport } = await import("./transport");

const call = (transport: ReturnType<typeof pacedRpcTransport>, id: number, method: string, params: unknown[]) =>
  transport({ payload: { jsonrpc: "2.0", id, method, params } }) as Promise<{ id: number; result: { context: unknown; value: unknown } }>;

afterEach(() => {
  sent.length = 0;
});

describe("getAccountInfo coalescing", () => {
  it("answers same-turn getAccountInfo calls from one getMultipleAccounts, each in its own shape and id", async () => {
    const transport = pacedRpcTransport("http://coalesce-a");
    const config = { encoding: "base64", commitment: "confirmed" };
    const [a, b, gone, again] = await Promise.all([
      call(transport, 1, "getAccountInfo", ["A", config]),
      call(transport, 2, "getAccountInfo", ["B", config]),
      call(transport, 3, "getAccountInfo", ["missing", config]),
      call(transport, 4, "getAccountInfo", ["A", config]),
    ]);
    expect(sent).toEqual([{ method: "getMultipleAccounts", params: [["A", "B", "missing"], config] }]);
    expect(a).toEqual({ jsonrpc: "2.0", id: 1, result: { context: { slot: 7n }, value: { data: ["A", "base64"] } } });
    expect(b.result.value).toEqual({ data: ["B", "base64"] });
    expect(gone.result.value).toBeNull();
    expect(again).toMatchObject({ id: 4, result: { value: { data: ["A", "base64"] } } });
  });

  it("keeps different configs apart and passes every other method straight through", async () => {
    const transport = pacedRpcTransport("http://coalesce-b");
    await Promise.all([
      call(transport, 1, "getAccountInfo", ["A", { encoding: "base64" }]),
      call(transport, 2, "getAccountInfo", ["B", { encoding: "base64", dataSlice: { offset: 0, length: 8 } }]),
      call(transport, 3, "getSlot", []),
    ]);
    expect(sent.map((s) => s.method).sort()).toEqual(["getMultipleAccounts", "getMultipleAccounts", "getSlot"]);
  });
});
