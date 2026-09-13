"use client";

import { Dialog } from "@base-ui/react/dialog";
import { formatCadence } from "@masayume/core/copy";
import type { LaneSet, Side } from "@masayume/core/types";
import { formatOracleRaw } from "@masayume/core/units";
import { useOpeningPrice } from "@masayume/markets/react";
import { UnplugIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { ORACLE_SCALE } from "@/features/markets/hero/units";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { ConnectButton } from "@/features/markets/wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { notify } from "@/lib/toast";
import { TAKES } from "./copy";
import { TAKE_MAX_CAPTION, normalizeCaption } from "./protocol";
import { useComposerMarket } from "./useComposerMarket";
import { usePostTake } from "./useTakes";

interface TakeComposerProps {
  laneSet: LaneSet | null;
  nowMs: number;
  /** null while unknown; false when this deployment has no social store. */
  configured: boolean | null;
  onClose: () => void;
}

const usd0 = (raw: bigint) => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;
const C = TAKES.composer;

/**
 * "Post a take" — ported from `reference/yosuku/components/TakeComposer624.tsx`.
 *
 * Three adaptations, each a truth about this venue:
 *  - The strike is not the user's to set. The reference seeds a strike from spot and
 *    lets you type one; a Window here settles against its opening print, so the
 *    "Strike" panel is the line, read-only, with spot beside it for context.
 *  - Range is present and disabled, naming what it waits on (RangeReserve, Stage 5),
 *    rather than a control that opens onto nothing.
 *  - The horizon row is the venue's live lanes, not a fixed 1m/5m/1h table.
 *
 * The sheet follows the theme, as the Room's does, on the user's 2026-09-01 ruling.
 * Base UI's Dialog brings the focus trap and dialog role the reference wires by hand.
 */
export function TakeComposer({ laneSet, nowMs, configured, onClose }: TakeComposerProps) {
  const { address } = useWalletSession();
  const horizon = useComposerMarket(laneSet, nowMs);
  const { post, busy, error } = usePostTake();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<Side>("down");
  const [caption, setCaption] = useState("");

  const market = horizon.market;
  const opening = useOpeningPrice(market?.marketId ?? null);
  const lineRaw = opening?.ok ? opening.value : (market?.openingPriceRaw ?? null);
  const spotRaw = useOracleSpot(market?.asset ?? null);

  const band = market === null ? null : lineRaw === null ? TAKES.noLine(market.asset) : side === "up" ? TAKES.over(market.asset, usd0(lineRaw)) : TAKES.under(market.asset, usd0(lineRaw));
  const canPost = configured === true && !!address && market !== null && !busy;

  const submit = async () => {
    if (!canPost || !market) return;
    const posted = await post({ marketId: market.marketId, side, caption: normalizeCaption(caption) });
    if (posted) {
      notify.neutral(C.posted);
      onClose();
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="take-scrim" />
        <Dialog.Popup ref={sheetRef} initialFocus={sheetRef} className="take-sheet" aria-label={C.title}>
          <div className="take-sheet-hairline" aria-hidden />
          <div className="take-sheet-body">
            <div className="take-sheet-head">
              <Dialog.Title className="take-sheet-title">{C.title}</Dialog.Title>
              <Dialog.Close className="take-sheet-close" aria-label={C.close} data-cursor="hover">
                <XIcon size={18} />
              </Dialog.Close>
            </div>
            <p className="take-sheet-where">{C.where}</p>

            {configured === false ? (
              <div className="take-state">
                <span className="take-state-icon" aria-hidden>
                  <UnplugIcon size={24} strokeWidth={1.8} />
                </span>
                <p className="take-state-title">{C.unavailable.title}</p>
                <p className="take-state-body">{C.unavailable.body}</p>
              </div>
            ) : (
              <>
                <div className="take-sides">
                  <button type="button" onClick={() => setSide("up")} data-on={side === "up"} data-cursor="hover">
                    {C.up}
                  </button>
                  <button type="button" onClick={() => setSide("down")} data-on={side === "down"} data-cursor="hover">
                    {C.down}
                  </button>
                  <button type="button" disabled title={C.rangePending} aria-label={`${C.range} — ${C.rangePending}`}>
                    {C.range}
                  </button>
                </div>

                <div className="take-line">
                  <div className="take-line-row">
                    <span className="take-line-label">{C.line}</span>
                    <span className="take-line-spot">{spotRaw === null ? "" : C.spot(usd0(spotRaw))}</span>
                  </div>
                  <div className="take-line-value">
                    <span className="take-line-sign">$</span>
                    <span className="take-line-figure" data-pending={lineRaw === null}>
                      {lineRaw === null ? C.linePending : formatOracleRaw(lineRaw, ORACLE_SCALE, 0)}
                    </span>
                  </div>
                  <p className="take-line-note">{C.lineNote}</p>
                </div>

                <div className="take-horizon">
                  <div className="take-horizon-label">{C.horizon}</div>
                  {horizon.lanes.length === 0 ? (
                    <p className="take-horizon-empty">{C.noWindows}</p>
                  ) : (
                    <div className="take-horizon-grid">
                      {horizon.lanes.map((lane) => (
                        <button
                          key={lane.intervalSec}
                          type="button"
                          onClick={() => horizon.setIntervalSec(lane.intervalSec)}
                          disabled={!horizon.hasLive(lane.intervalSec)}
                          data-on={horizon.intervalSec === lane.intervalSec}
                          data-cursor="hover"
                        >
                          {formatCadence(lane.intervalSec)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="take-words">
                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value.slice(0, TAKE_MAX_CAPTION))}
                    placeholder={C.captionPlaceholder}
                    rows={2}
                    maxLength={TAKE_MAX_CAPTION}
                    aria-label={C.captionPlaceholder}
                  />
                  <div className="take-count">
                    {caption.length}/{TAKE_MAX_CAPTION}
                  </div>
                </div>

                <div className="take-preview">
                  <div className="take-preview-label">{C.calling}</div>
                  <div className="take-preview-call">
                    {side === "up" ? "▲" : "▼"} {band ?? "—"}
                    <span className="take-preview-window"> · {market ? TAKES.window(formatCadence(market.intervalSec)) : C.noMarket}</span>
                  </div>
                </div>

                {error && <p className="take-error">{error}</p>}

                {!address ? (
                  <div className="take-connect">
                    <ConnectButton />
                  </div>
                ) : (
                  <button type="button" className="take-post" onClick={() => void submit()} disabled={!canPost} data-cursor="hover">
                    {busy ? C.posting : market === null ? C.noLiveMarket : C.post}
                  </button>
                )}
                <p className="take-permanence">{C.permanence}</p>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
