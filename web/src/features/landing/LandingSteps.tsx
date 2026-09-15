import { LANDING } from "./copy";

/**
 * "A call in three steps": Yosuku's numbered step grammar (`.step .num`, the mono kicker, the display title) laid out as
 * three columns, each with a small token-coloured specimen of what the step touches. Server-rendered; no data.
 */
export function LandingSteps() {
  return (
    <ol className="lp-steps">
      {LANDING.steps.items.map((step, index) => (
        <li key={step.kicker} className="lp-step" data-step={index + 1}>
          <span className="lp-step-num" aria-hidden>
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="lp-step-kicker">{step.kicker}</p>
          <h3 className="lp-step-title">{step.title}</h3>
          <p className="lp-step-body">{step.body}</p>
          <div className="lp-step-art" aria-hidden>
            {step.art.map((chip) => (
              <span key={chip.word} className="lp-chip" data-tone={"tone" in chip ? chip.tone : undefined}>
                {chip.word}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
