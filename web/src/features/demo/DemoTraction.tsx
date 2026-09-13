"use client";

import { Fragment, useEffect, useState } from "react";
import { leaderboardPayloadSchema, type LeaderboardPayload } from "@/features/leaderboard/protocol";
import { DEMO } from "./copy";

type Traction = { state: "reading" } | { state: "failed" } | { state: "ok"; meta: LeaderboardPayload["meta"] };

/**
 * The traction line under the hero — the reference prints "18 wallets · 51 gas-free
 * trades · ~1,800 SDK installs" as static text. Here the figures are read live from
 * the same venue scan the leaderboard runs (`/api/leaderboard`), so the line can be
 * wrong only in the direction of being out of date, never invented. The cold route
 * takes a while; the line says it is reading rather than showing nothing.
 */
export function DemoTraction() {
  const [traction, setTraction] = useState<Traction>({ state: "reading" });

  useEffect(() => {
    let alive = true;
    void fetch("/api/leaderboard")
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const parsed = leaderboardPayloadSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("shape");
        if (alive) setTraction({ state: "ok", meta: parsed.data.meta });
      })
      .catch(() => {
        if (alive) setTraction({ state: "failed" });
      });
    return () => {
      alive = false;
    };
  }, []);

  const items = tractionItems(traction);
  return (
    <div className="demo-traction" aria-live="polite">
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 && (
            <span className="demo-traction-dot" aria-hidden>
              ·
            </span>
          )}
          <span>{item}</span>
        </Fragment>
      ))}
    </div>
  );
}

function tractionItems(traction: Traction): string[] {
  if (traction.state === "reading") return [DEMO.traction.reading, DEMO.traction.live];
  if (traction.state === "failed") return [DEMO.traction.failed, DEMO.traction.live];
  const { meta } = traction;
  const items = [
    DEMO.traction.wallets(meta.rankedTraders.toLocaleString("en-US")),
    DEMO.traction.calls(meta.closedCalls.toLocaleString("en-US")),
    DEMO.traction.period(meta.period),
  ];
  if (!meta.complete) items.push(DEMO.traction.partial);
  items.push(DEMO.traction.live);
  return items;
}
