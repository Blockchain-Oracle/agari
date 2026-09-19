import Link from "next/link";
import { LANDING } from "./copy";
import { LandingCoverCard } from "./LandingCoverCard";

const PORTFOLIO_PATH = "/portfolio";

/**
 * "Cover what you hold" (plan Step 6, D-100): the plain-words case for the feature that makes a prediction market
 * useful to someone who already owns a stock token, next to the card itself. Server-rendered copy; the card is the
 * one client island, and it adds no data path (sample holdings through the real picker).
 */
export function LandingCover() {
  const { cover } = LANDING;
  return (
    <div className="lp-cover">
      <div className="lp-cover-copy">
        {cover.paragraphs.map((text) => (
          <p key={text.slice(0, 24)} className="lp-cover-p">
            {text}
          </p>
        ))}
        <p className="lp-cover-story">{cover.story}</p>
        <p className="lp-cover-note">
          {cover.note}{" "}
          <Link href={PORTFOLIO_PATH} className="lp-link" data-cursor="hover">
            {cover.portfolio}
          </Link>
        </p>
      </div>
      <div className="lp-cover-card">
        <LandingCoverCard />
      </div>
    </div>
  );
}
