"use client";

import { useState } from "react";
import { SessionChip } from "./SessionChip";
import { useSessionKey } from "./SessionKeyProvider";
import { SessionManager } from "./SessionManager";
import { SessionModal } from "./SessionModal";

/** The chip and the two sheets it opens: arm when there is nothing, manage when there is. */
export function SessionControl({ symbol }: { symbol: string }) {
  const { view } = useSessionKey();
  const [sheet, setSheet] = useState(false);
  const [manager, setManager] = useState(false);
  const open = () => {
    if (view.status === "disarmed") setSheet(true);
    else setManager(true);
  };
  return (
    <>
      <SessionChip status={view.status} onClick={open} />
      <SessionModal open={sheet} onOpenChange={setSheet} symbol={symbol} />
      <SessionManager
        open={manager}
        onOpenChange={setManager}
        symbol={symbol}
        onArmNew={() => {
          setManager(false);
          setSheet(true);
        }}
      />
    </>
  );
}
