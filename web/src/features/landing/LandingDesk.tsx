import Link from "next/link";
import { LANDING } from "./copy";

const DESK_PATH = "/desk";
const DEV_DESK_PATH = "/dev/desk";

/**
 * "Let a desk hold it" (S21, plan §5.2 landing section): the plain-words case for the one place real money moves,
 * beside the promise the desk page makes. Server-rendered copy, no data path; the links open the desk and the
 * fixtures page judges can read without a wallet (plan §5.11).
 */
export function LandingDesk() {
  const { desk } = LANDING;
  return (
    <div className="lp-cover">
      <div className="lp-cover-copy">
        {desk.paragraphs.map((text) => (
          <p key={text.slice(0, 24)} className="lp-cover-p">
            {text}
          </p>
        ))}
        <p className="lp-cover-story">{desk.story}</p>
        <p className="lp-cover-note">
          {desk.note}{" "}
          <Link href={DESK_PATH} className="lp-link" data-cursor="hover">
            {desk.open}
          </Link>{" "}
          <Link href={DEV_DESK_PATH} className="lp-link" data-cursor="hover">
            {desk.fixtures}
          </Link>
        </p>
      </div>
      <div className="lp-cover-card">
        <ol className="lp-desk-promise">
          {desk.promise.map((point, i) => (
            <li key={point}>
              <span className="lp-desk-n">{String(i + 1).padStart(2, "0")}</span>
              {point}
            </li>
          ))}
        </ol>
        <p className="lp-cover-note">{desk.worstCase}</p>
      </div>
    </div>
  );
}
