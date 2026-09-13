"use client";

import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits } from "@masayume/core/units";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useRef, useState, type RefObject } from "react";
import { useDisconnect } from "wagmi";
import { useBalancePlate } from "@/features/markets/balance";
import { ACCOUNT_MENU, BANNER, CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useFloatingMenus } from "./useFloatingMenus";

const AMOUNT_DP = 2;

/**
 * The address pill and its menu — the reference's (`Header.tsx` L322–364), whole: the `addr-dot` avatar
 * and the short address; a menu of exactly two balance rows (Trading account, Wallet), Portfolio, and
 * Disconnect. The links to Claims, Add funds and X recovery that had grown in here are gone: the money
 * pill beside this opens Add money, claiming is on the Window's own result, and X recovery is reached
 * from `/trade-from-x` as in the reference. A balance that has not been read yet shows an em dash.
 */
export function HeaderAccount({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { isRightChain, switching, switchToShannon } = useWalletSession();
  const { disconnect } = useDisconnect();
  const balance = useBalancePlate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const refs = useRef<ReadonlyArray<RefObject<HTMLElement | null>>>([menuRef]);
  useFloatingMenus(refs.current, () => setOpen(false));

  const reading = balance.kind === "connected" ? balance.reading : null;
  const sheet = reading && isOk(reading) ? reading.value : null;
  const amount = (value: bigint | null) =>
    sheet && value !== null ? formatBaseUnits(value, sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) : "—";

  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        // Before hydration server and client must agree, so the control is present but inert.
        if (!mounted) {
          return (
            <button type="button" className="btn btn-primary invisible" aria-hidden="true" tabIndex={-1}>
              {CONNECT.connect}
            </button>
          );
        }

        if (!account || !chain) {
          return (
            <button type="button" className="btn btn-primary" onClick={openConnectModal} data-cursor="hover">
              {CONNECT.connect}
            </button>
          );
        }

        if (!isRightChain) {
          return (
            <button type="button" className="btn btn-outline" onClick={switchToShannon} disabled={switching} data-cursor="hover">
              {switching ? BANNER.switching : CONNECT.wrongChain}
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
              <span>{account.displayName}</span>
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
                    disconnect();
                    setOpen(false);
                  }}
                >
                  {CONNECT.disconnect}
                </button>
              </div>
            )}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
