import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configs: [] as { maxRetries: number }[], post: vi.fn(), upload: vi.fn(), search: vi.fn(), details: vi.fn() }));
vi.mock("rettiwt-api", () => ({
  Rettiwt: class {
    tweet = { post: mocks.post, upload: mocks.upload, search: mocks.search };
    user = { details: mocks.details };
    constructor(options: { maxRetries: number }) { mocks.configs.push(options); }
  },
}));
import { rettiwtTransport } from "./rettiwt";

describe("X media transport", () => {
  beforeEach(() => { mocks.configs.length = 0; vi.clearAllMocks(); });

  const tweet = (id: string) => ({ id, tweetBy: { id: "55", userName: "caller" }, fullText: "BTC UP 5 5m" });
  it("verifies the session's stable identity and retains reply-parent metadata", async () => {
    mocks.details.mockResolvedValue({ id: "99", userName: "BOT" });
    const transport = rettiwtTransport("fixture", "@bot");
    expect(await transport.authenticatedAuthorId()).toBe("99");
    expect(mocks.details).toHaveBeenCalledWith();
    mocks.search.mockResolvedValue({ list: [{ ...tweet("30"), replyTo: "20" }, tweet("31")] });
    expect(await transport.fetchMentions("0")).toMatchObject([{ id: "30", replyTo: "20" }, { id: "31", replyTo: null }]);
  });
  it.each([undefined, { id: "99", userName: "wrong" }, { id: "invalid", userName: "bot" }])("fails closed for an unverified account identity", async profile => {
    mocks.details.mockResolvedValue(profile);
    await expect(rettiwtTransport("fixture", "bot").authenticatedAuthorId()).rejects.toThrow("identity");
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("drains multiple pages beyond twenty, deduplicates, and processes oldest first", async () => {
    mocks.search.mockResolvedValueOnce({ list: Array.from({ length: 20 }, (_, i) => tweet(String(40 - i))), next: "page2" })
      .mockResolvedValueOnce({ list: [tweet("21"), ...Array.from({ length: 20 }, (_, i) => tweet(String(20 - i)))], next: "page3" })
      .mockResolvedValueOnce({ list: [], next: null });
    const result = await rettiwtTransport("fixture", "bot").fetchMentions("0");
    expect(result.map(m => m.id)).toEqual(Array.from({ length: 40 }, (_, i) => String(i + 1)));
    expect(mocks.search.mock.calls[1]).toEqual([{ mentions: ["bot"], sinceId: "0" }, 20, "page2"]);
  });

  it("fails the entire drain on a later page error or repeated cursor", async () => {
    mocks.search.mockResolvedValueOnce({ list: [tweet("30")], next: "next" }).mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(rettiwtTransport("fixture", "bot").fetchMentions("0")).rejects.toThrow("provider unavailable");
    mocks.search.mockResolvedValue({ list: [tweet("30")], next: "same" });
    await expect(rettiwtTransport("fixture", "bot").fetchMentions("0")).rejects.toThrow("repeated a cursor");
  });

  it("reads only the newest page when establishing a first-start baseline", async () => {
    mocks.search.mockResolvedValue({ list: [tweet("30")], next: "history" });
    await expect(rettiwtTransport("fixture", "bot").fetchMentions(null)).resolves.toMatchObject([{ id: "30" }]);
    expect(mocks.search).toHaveBeenCalledOnce();
  });

  it("uploads image bytes and attaches its id while retaining the reply target", async () => {
    mocks.upload.mockResolvedValue("456");
    mocks.post.mockResolvedValue("789");
    const transport = rettiwtTransport("fixture-key", "@masayume_app");
    const media = await transport.uploadImage!(new Uint8Array([1, 2, 3]));
    await expect(transport.reply!("123", "Order filled\nSpent 3 tUSDC.", media)).resolves.toBe("789");
    expect(mocks.upload.mock.calls[0]![0]).toBeInstanceOf(ArrayBuffer);
    expect(mocks.post).toHaveBeenCalledWith({ text: "Order filled\nSpent 3 tUSDC.", replyTo: "123", media: [{ id: "456" }] });
    expect(mocks.configs.map(c => c.maxRetries)).toEqual([2, 0]);
  });

  it("keeps text-only replies free of media fields", async () => {
    mocks.post.mockResolvedValue("789");
    await rettiwtTransport("fixture-key", "masayume_app").reply!("123", "Status needs checking");
    expect(mocks.post).toHaveBeenCalledWith({ text: "Status needs checking", replyTo: "123" });
  });

  it.each(["a".repeat(281), "Unbudgeted emoji 🚀"])("rejects text outside the formatter contract", async text => {
    await expect(rettiwtTransport("fixture-key", "masayume_app").reply!("123", text)).rejects.toThrow("ASCII budget");
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("does not turn a missing media id into an attached image", async () => {
    mocks.upload.mockResolvedValue("");
    await expect(rettiwtTransport("fixture-key", "masayume_app").uploadImage!(new Uint8Array([1]))).rejects.toThrow("media id");
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
