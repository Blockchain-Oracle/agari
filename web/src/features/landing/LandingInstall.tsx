import { InstallCta } from "../install/InstallCta";
import { LANDING } from "./copy";

/** The install strip: the `/download` page's own stateful button (`InstallCta`), under one line that says what it installs. */
export function LandingInstall() {
  const { install } = LANDING;
  return (
    <div className="lp-install">
      <div className="lp-install-copy">
        <div className="section-eyebrow">{install.eyebrow}</div>
        <h2 className="lp-install-title">{install.title}</h2>
        <p className="lp-install-line">{install.line}</p>
      </div>
      <div className="lp-install-cta">
        <InstallCta />
      </div>
    </div>
  );
}
