import { expect, it, vi } from "vitest";
import { createDryReadSession } from "./dry-read-session";

const REQUEST = { persona: "Hold when depth is thin.", posture: "balanced" as const, cadences: [900], stakeBase: "1000000" };
const ERROR = (text: string) => new Response(JSON.stringify({ error: text }), { status: 503 });

it("does not let a late response from an edited draft restore its stale result", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn<typeof fetch>(() => new Promise((done) => { resolve = done; }));
  const emit = vi.fn();
  const session = createDryReadSession(emit, "Unavailable", fetcher);
  const read = session.read(REQUEST);
  const signal = fetcher.mock.calls[0]?.[1]?.signal;
  session.reset();
  expect(signal?.aborted).toBe(true);
  resolve(ERROR("Old draft failed"));
  await read;
  expect(emit.mock.calls.map(([state]) => state.status)).toEqual(["reading", "idle"]);
});

it("keeps the newest request's result when the provider answers out of order", async () => {
  const resolves: Array<(response: Response) => void> = [];
  const fetcher = vi.fn<typeof fetch>(() => new Promise((done) => { resolves.push(done); }));
  const emit = vi.fn();
  const session = createDryReadSession(emit, "Unavailable", fetcher);
  const old = session.read(REQUEST);
  const current = session.read({ ...REQUEST, stakeBase: "2000000" });
  resolves[1]!(ERROR("Current market unavailable"));
  await current;
  resolves[0]!(ERROR("Old market unavailable"));
  await old;
  expect(emit).toHaveBeenLastCalledWith({ status: "error", error: "Current market unavailable" });
  expect(emit).toHaveBeenCalledTimes(3);
});
