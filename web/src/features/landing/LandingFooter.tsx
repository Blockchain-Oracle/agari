import Link from "next/link";
import { MARKETS_PATH } from "@/lib/routes";
import { INSTALL } from "../install/copy";
import { LANDING, LANDING_ADVICE_SLOT } from "./copy";
import { DOWNLOAD_PATH, HOW_IT_WORKS_PATH } from "./paths";

/**
 * The landing's last word before the shell footer: the devnet + tUSDC honesty line the download page already says
 * (`INSTALL.foot`), the "not investment advice" slot lane 15d fills at merge, and the three story links.
 */
export function LandingFooter() {
  const { foot } = LANDING;
  return (
    <div className="lp-foot">
      <div className="lp-foot-copy">
        <p className="lp-foot-line">{INSTALL.foot}</p>
        {LANDING_ADVICE_SLOT !== null && (
          <p className="lp-foot-line lp-foot-advice" data-slot="not-investment-advice">
            {LANDING_ADVICE_SLOT}
          </p>
        )}
      </div>
      <nav className="lp-foot-links" aria-label={foot.nav}>
        <Link href={MARKETS_PATH} className="lp-link" data-cursor="hover">
          {foot.markets}
        </Link>
        <Link href={HOW_IT_WORKS_PATH} className="lp-link" data-cursor="hover">
          {foot.howItWorks}
        </Link>
        <Link href={DOWNLOAD_PATH} className="lp-link" data-cursor="hover">
          {foot.download}
        </Link>
      </nav>
    </div>
  );
}
