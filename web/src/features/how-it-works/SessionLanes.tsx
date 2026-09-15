import { CalendarClockIcon } from "lucide-react";
import { HOW_IT_WORKS } from "./copy";
import { riseDelay } from "./rise";
import { ASIDES, LANES, PRE_OPEN, SESSION_WORDS } from "./sessions";

/**
 * The two sections Masayume's page has no room for, drawn in its own card grammar (D-081): "Sessions & Lanes" sits
 * between Getting Started and Key Mechanics, "Halts, Voids & Your Money" between the Settlement Process and the
 * On-Chain Architecture. Every class here is one the reference's stylesheet already defines — a lane card is a
 * `hiw-card`, the session words are the `hiw-params` definition list the pricing section uses, and the pre-open
 * promise is the `hiw-steps` list the settlement section uses. No new CSS, so nothing can drift from the source.
 */

const LANES_BASE_MS = 250;
const ASIDE_BASE_MS = 600;

export function SessionLanes() {
  return (
    <section className="hiw-section" aria-label={HOW_IT_WORKS.sections.sessions}>
      <h2 className="hiw-label">
        <CalendarClockIcon aria-hidden />
        {HOW_IT_WORKS.sections.sessions}
      </h2>
      <p className="hiw-body" style={{ marginBottom: 16 }}>
        {HOW_IT_WORKS.sessionsLead}
      </p>

      <div className="hiw-grid hiw-arch">
        {LANES.map((lane, index) => (
          <article key={lane.name} className="hiw-card hiw-rise" style={riseDelay(index, LANES_BASE_MS)}>
            <div className="hiw-card-head">
              <span className="hiw-icon" aria-hidden>
                <lane.icon />
              </span>
              <h3 className="hiw-card-title" style={{ marginBottom: 0 }}>
                {lane.name}
              </h3>
            </div>
            <p className="hiw-example-tag">{lane.clock}</p>
            <p className="hiw-body">{lane.body}</p>
          </article>
        ))}
      </div>

      <div className="hiw-card hiw-card-wide hiw-rise" style={riseDelay(3, LANES_BASE_MS)}>
        <h3 className="hiw-fee-title">{HOW_IT_WORKS.sessionWordsTitle}</h3>
        <p className="hiw-body" style={{ marginBottom: 24 }}>
          {HOW_IT_WORKS.sessionWordsBody}
        </p>
        <dl className="hiw-params">
          {SESSION_WORDS.map(([word, meaning]) => (
            <div key={word}>
              <dt>{word}</dt>
              <dd>: {meaning}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="hiw-card hiw-card-wide hiw-card-mint hiw-rise" style={{ ...riseDelay(4, LANES_BASE_MS), marginTop: 16 }}>
        <h3 className="hiw-fee-title">{PRE_OPEN.title}</h3>
        <p className="hiw-body" style={{ marginBottom: 24 }}>
          {PRE_OPEN.body}
        </p>
        <ol className="hiw-steps">
          {PRE_OPEN.points.map((point, index) => (
            <li key={point} className="contents">
              <div>
                <span className="hiw-step-num" aria-hidden>
                  {index + 1}
                </span>
                <div className="hiw-body">{point}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Halts, voids and money — the three things a stranger asks about once they understand the happy path. */
export function Asides() {
  return (
    <section className="hiw-section" aria-label={HOW_IT_WORKS.sections.asides}>
      <h2 className="hiw-label">{HOW_IT_WORKS.sections.asides}</h2>
      <div className="hiw-card hiw-card-wide hiw-fees hiw-rise" style={riseDelay(0, ASIDE_BASE_MS)}>
        {ASIDES.map((aside) => (
          <div key={aside.title}>
            <div className="hiw-card-head">
              <span className="hiw-icon" aria-hidden>
                <aside.icon />
              </span>
              <h3 className="hiw-fee-title" style={{ marginBottom: 0 }}>
                {aside.title}
              </h3>
            </div>
            <p className="hiw-body">{aside.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
