"use client";

import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import Link from "next/link";
import { useRef, useState, type RefObject } from "react";
import { useBalancePlate } from "@/features/markets/balance";
import { ACCOUNT_MENU, CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useFloatingMenus } from "./useFloatingMenus";

const AMOUNT_DP = 2;

/**
 * The address pill and its menu — the reference's (`Header.tsx` L322–364), whole: the `addr-dot` avatar
 * and the short address; a menu of exactly two balance rows (Trading account, Wallet), Portfolio, and
 * Disconnect (a Privy logout). The links to Claims, Add funds and X recovery that had grown in here are gone: the money
 * pill beside this opens Add money, claiming is on the Window's own result, and X recovery is reached
 * from `/trade-from-x` as in the reference. A balance that has not been read yet shows an em dash.
 */
export function HeaderAccount({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const session = useWalletSession();
  const balance = useBalancePlate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const refs = useRef<ReadonlyArray<RefObject<HTMLElement | null>>>([menuRef]);
  useFloatingMenus(refs.current, () => setOpen(false));

  const reading = balance.kind === "connected" ? balance.reading : null;
  const sheet = reading && isOk(reading) ? reading.value : null;
  const amount = (value: bigint | null) =>
    sheet && value !== null ? formatBaseUnits(value, sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) : "—";

  // Before hydration, and while Privy restores a remembered session, server and client must agree: the control is present but inert.
  if (session.isConnecting) {
    return (
      <button type="button" className="btn btn-primary invisible" aria-hidden="true" tabIndex={-1}>
        {CONNECT.connect}
      </button>
    );
  }

  if (!session.isConnected || !session.address) {
    return (
      <button
        type="button"
        className="btn btn-primary"
        onClick={session.login}
        onPointerEnter={session.prefetch}
        onFocus={session.prefetch}
        disabled={!session.available}
        title={session.available ? undefined : CONNECT.unavailable}
        data-cursor="hover"
      >
        {CONNECT.connect}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef} data-cursor="hover">
      <button
        type="button"
        className="wallet-pill"
        aria-label={ACCOUNT_MENU.open}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          onOpenMenu?.();
        }}
      >
        <span className="addr-dot" />
        {/* Base58 is shown exactly as written, never re-cased (D-010). */}
        <span title={session.address}>{shortHex(session.address, 4, 4)}</span>
      </button>

      {open && (
        <div className="header-account-menu" role="menu">
          <div className="header-account-pools">
            <div className="header-account-row">
              <span>{ACCOUNT_MENU.tradingAccount}</span>
              <span className="val">{amount(sheet?.vaultBase ?? null)}</span>
            </div>
            <div className="header-account-row">
              <span>{ACCOUNT_MENU.wallet}</span>
              <span className="val val--soft">{amount(sheet?.spendableBase ?? null)}</span>
            </div>
          </div>
          <Link href="/portfolio" className="header-account-link" role="menuitem" onClick={() => setOpen(false)}>
            {ACCOUNT_MENU.portfolio}
          </Link>
          <button
            type="button"
            className="header-account-link header-account-link--danger"
            role="menuitem"
            onClick={() => {
              void session.logout();
              setOpen(false);
            }}
          >
            {CONNECT.disconnect}
          </button>
        </div>
      )}
    </div>
  );
}
