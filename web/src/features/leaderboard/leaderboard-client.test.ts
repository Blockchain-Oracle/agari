import { afterEach, expect, it, vi } from "vitest";
import { BOARD_REQUEST_TIMEOUT_MS, readLeaderboard } from "./leaderboard-client";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("ends a stalled request at its deadline", async () => {
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  })));
  const pending = readLeaderboard();
  deadline.abort(new DOMException("Timed out", "TimeoutError"));
  await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
  expect(timeout).toHaveBeenCalledWith(BOARD_REQUEST_TIMEOUT_MS);
});

it("cancels a request when the page no longer needs it", async () => {
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  })));
  const pending = readLeaderboard(controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("rejects unavailable and malformed responses instead of presenting them as an empty board", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response('{"rankings": []}'));
  vi.stubGlobal("fetch", fetch);
  await expect(readLeaderboard()).rejects.toThrow("503");
  await expect(readLeaderboard()).rejects.toThrow();
});
