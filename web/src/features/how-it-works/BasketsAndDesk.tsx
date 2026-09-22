import { LayersIcon, ListChecksIcon } from "lucide-react";
import { BASKETS, DESK_NEVER, DESK_PROGRAM_ENFORCES, DESK_STEPS } from "./content";
import { HOW_IT_WORKS } from "./copy";
import { riseDelay } from "./rise";

/**
 * Two more sections of Agari's own (D-081), drawn only with classes the reference's stylesheet already defines:
 * "Baskets" (S19) as the `hiw-params` definition list the pricing section uses, and "How the Desk Decides" (S21) as
 * the `hiw-steps` list the settlement section uses, each step tagged with which kind of work it is, then two
 * `hiw-arch` cards for what the program enforces and what the desk never does. They sit after "Halts, Voids & Your
 * Money", because a reader meets the desk only once the happy path and the money rules are clear.
 */

const BASE_MS = 650;

function Definitions({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="hiw-params" style={{ gridTemplateColumns: "1fr" }}>
      {rows.map(([word, meaning]) => (
        <div key={word}>
          <dt>{word}</dt>
          <dd>: {meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BasketsAndDesk() {
  return (
    <>
      <section className="hiw-section" aria-label={HOW_IT_WORKS.sections.baskets}>
        <h2 className="hiw-label">
          <LayersIcon aria-hidden />
          {HOW_IT_WORKS.sections.baskets}
        </h2>
        <div className="hiw-card hiw-card-wide hiw-rise" style={riseDelay(0, BASE_MS)}>
          <p className="hiw-body" style={{ marginBottom: 24 }}>
            {BASKETS.body}
          </p>
          <Definitions rows={BASKETS.uses} />
        </div>
      </section>

      <section className="hiw-section" aria-label={HOW_IT_WORKS.sections.desk}>
        <h2 className="hiw-label hiw-label-blue">
          <ListChecksIcon aria-hidden />
          {HOW_IT_WORKS.sections.desk}
        </h2>
        <p className="hiw-body" style={{ marginBottom: 16 }}>
          {HOW_IT_WORKS.deskLead}
        </p>
        <div className="hiw-card hiw-card-wide hiw-card-blue hiw-rise" style={riseDelay(1, BASE_MS)}>
          <ol className="hiw-steps">
            {DESK_STEPS.map((item) => (
              <li key={item.step} className="contents">
                <div>
                  <span className="hiw-step-num" aria-hidden>
                    {item.step}
                  </span>
                  <div>
                    <div className="hiw-step-label">{item.label}</div>
                    <p className="hiw-example-tag" style={{ marginBottom: 8 }}>
                      {HOW_IT_WORKS.deskKinds[item.kind]}
                    </p>
                    <div className="hiw-body">{item.desc}</div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="hiw-grid hiw-arch" style={{ marginTop: 16 }}>
          <article className="hiw-card hiw-card-blue hiw-rise" style={riseDelay(2, BASE_MS)}>
            <h3 className="hiw-fee-title">{HOW_IT_WORKS.deskEnforcesTitle}</h3>
            <Definitions rows={DESK_PROGRAM_ENFORCES} />
          </article>
          <article className="hiw-card hiw-rise" style={riseDelay(3, BASE_MS)}>
            <h3 className="hiw-fee-title">{HOW_IT_WORKS.deskNeverTitle}</h3>
            <Definitions rows={DESK_NEVER} />
          </article>
        </div>
        <p className="hiw-example-tag" style={{ marginTop: 16 }}>
          {HOW_IT_WORKS.deskNetwork}
        </p>
      </section>
    </>
  );
}
