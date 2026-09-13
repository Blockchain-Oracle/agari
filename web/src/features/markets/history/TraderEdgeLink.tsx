import Link from "next/link";
import { HISTORY } from "./copy";

export const EDGE_PATH = "/portfolio/edge";

/** The reference's `TraderEdgeLink`, ported with its own stylesheet (`trader-edge-link.css`). */
export function TraderEdgeLink() {
  const words = HISTORY.edgeLink;
  return (
    <Link href={EDGE_PATH} className="trader-edge-link" data-cursor="hover">
      <div>
        <div className="tel-eyebrow">{words.eyebrow}</div>
        <h2 className="tel-title">{words.title}</h2>
        <p className="tel-copy">{words.copy}</p>
      </div>
      <span className="tel-action">
        {words.action}{" "}
        <span className="tel-arrow" aria-hidden="true">
          →
        </span>
      </span>
    </Link>
  );
}
