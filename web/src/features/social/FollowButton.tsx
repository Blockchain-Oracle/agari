"use client";

import type { Address } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { SOCIAL } from "./copy";
import { readSocialToken } from "./session-store";
import { useFollows, useFollowToggle } from "./useFollows";
import "./social.css";

/**
 * Follow and unfollow one wallet, as the reference's pill buttons (`.btn`): vermilion to follow, a hairline outline
 * once following (it reads "Unfollow" on hover). The first press in an hour asks the wallet to sign the social session
 * text; every other press is a plain request. Your own profile says so instead of offering a button.
 */
export function FollowButton({ wallet, className }: { wallet: Address; className?: string }) {
  const { address, connect } = useWalletSession();
  const mine = useFollows(address);
  const toggle = useFollowToggle();

  if (address === wallet) return <span className={cn("soc-self", className)}>{SOCIAL.self}</span>;

  const following = mine.data?.following.includes(wallet) ?? false;
  const unavailable = mine.data?.configured === false;
  const pending = toggle.pending === wallet;
  const short = shortHex(wallet);
  const label = !address ? SOCIAL.connect : pending ? (readSocialToken(address) ? SOCIAL.saving : SOCIAL.working) : following ? SOCIAL.following : SOCIAL.follow;

  return (
    <span className={cn("soc-follow-wrap", className)}>
      <button
        type="button"
        className={cn("btn soc-follow", following && !pending ? "btn-outline is-following" : "btn-primary")}
        aria-pressed={address ? following : undefined}
        aria-label={address ? (following ? SOCIAL.unfollowLabel(short) : SOCIAL.followLabel(short)) : SOCIAL.connect}
        disabled={pending || unavailable || (address !== null && mine.data === null)}
        title={unavailable ? SOCIAL.unavailable : undefined}
        onClick={() => (address ? void toggle.setFollow(wallet, !following) : connect())}
        data-cursor="hover"
      >
        <span className="soc-follow-label">{label}</span>
        {following && !pending && (
          <span className="soc-follow-hover" aria-hidden>
            {SOCIAL.unfollow}
          </span>
        )}
      </button>
      {toggle.error && (
        <span className="soc-error" role="alert">
          {toggle.error}
        </span>
      )}
    </span>
  );
}
