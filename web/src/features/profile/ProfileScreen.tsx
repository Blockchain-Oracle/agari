"use client";

import type { Address } from "@agari/core/types";
import { addressUrl } from "@agari/core/urls";
import { keys, useWalletHistory } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useState, type CSSProperties } from "react";
import { useMoneyUnits } from "@/features/activity/useActivity";
import { FollowButton } from "@/features/social/FollowButton";
import { useFollows } from "@/features/social/useFollows";
import { addressHue } from "@/lib/address-hue";
import { useWalletSession } from "@/lib/wallet-session";
import { PROFILE } from "./copy";
import { ProfileCalls } from "./ProfileCalls";
import { ProfileRecord } from "./ProfileRecord";
import "./profile.css";

const TAIL = 4;
const LEAD = 6;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="prf-stat">
      <dt>{label}</dt>
      <dd className="big">{value}</dd>
    </div>
  );
}

/**
 * `/u/[address]` (spec §1.6): identity, follows, then the record, the edge excerpt, open calls and takes. Every figure
 * is public index data read the way Portfolio and Trader Edge read the viewer's own; nothing here needs a signature
 * except the Follow button's first press.
 */
export function ProfileScreen({ address, xHandle }: { address: Address; xHandle: string | null }) {
  const { address: viewer } = useWalletSession();
  const own = viewer === address;
  const units = useMoneyUnits();
  const history = useWalletHistory(address);
  const follows = useFollows(address);
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries({ queryKey: keys.history(address) }), [address, queryClient]);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const counts = follows.data?.configured ? follows.data.counts : null;

  return (
    <div className="container news-page prf-page">
      <div className="news-inner">
        <div className="news-live">
          <span className="news-live-dot" aria-hidden />
          <span className="news-live-label">{own ? PROFILE.eyebrowYou : PROFILE.eyebrow}</span>
        </div>
        <div className="prf-ident">
          <span aria-hidden className="prf-avatar" style={{ "--prf-hue": addressHue(address) } as CSSProperties} />
          <h1 className="news-title prf-title" title={address}>
            {address.slice(0, LEAD)}…<span className="vermilion">{address.slice(-TAIL)}</span>
          </h1>
        </div>
        <div className="page-title-jp" lang="ja">
          {PROFILE.headingJp}
        </div>
        <p className="news-intro">{PROFILE.intro}</p>

        <div className="prf-bar">
          <dl className="prf-stats">
            <Stat label={PROFILE.followers} value={counts ? counts.followers.toLocaleString() : PROFILE.dash} />
            <Stat label={PROFILE.following} value={counts ? counts.following.toLocaleString() : PROFILE.dash} />
            {xHandle && (
              <div className="prf-stat">
                <dt>
                  {PROFILE.x} · {PROFILE.xVerified}
                </dt>
                <dd className="big">
                  <a href={`https://x.com/${encodeURIComponent(xHandle)}`} target="_blank" rel="noopener noreferrer" data-cursor="hover">
                    @{xHandle}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <div className="prf-actions">
            <FollowButton wallet={address} />
            <div className="asset-tabs">
              <button type="button" className="asset-tab" onClick={copy} data-cursor="hover">
                {copied ? PROFILE.copied : PROFILE.copy}
              </button>
              <a className="asset-tab" href={addressUrl(address)} target="_blank" rel="noopener noreferrer" data-cursor="hover">
                {PROFILE.explorer}
              </a>
              {/* A-3b: copying a wallet needs nothing from its owner — their calls are on chain — so this is offered
                  on any profile but your own, and it opens the studio with the address already in it. */}
              {!own && (
                <Link className="asset-tab" href={`/strategies?copy=${address}`} data-cursor="hover">
                  {PROFILE.copyTrader}
                </Link>
              )}
            </div>
          </div>
        </div>

        <ProfileRecord address={address} reading={history} retry={retry} symbol={units.symbol} own={own} />
        <ProfileCalls address={address} units={units} />
      </div>
    </div>
  );
}
