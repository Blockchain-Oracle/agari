import { Fragment } from "react";

/**
 * `text`, with every occurrence of `symbol` kept in its own casing under an uppercasing label.
 *
 * "tUSDC" is a name with fixed casing: a label's `text-transform: uppercase` turns it into "TUSDC", which reads as
 * another token (TrueUSD). `.sym` (`styles/tokens.css`) resets the transform for the symbol alone, so the label
 * keeps its ported style and the unit keeps its name.
 */
export function KeepCase({ text, symbol }: { text: string; symbol: string }) {
  if (!symbol || !text.includes(symbol)) return <>{text}</>;
  return (
    <>
      {text.split(symbol).map((part, i) => (
        // The parts are a fixed split of one string, so position plus text is a stable key.
        <Fragment key={`${i}:${part}`}>
          {i > 0 && <span className="sym">{symbol}</span>}
          {part}
        </Fragment>
      ))}
    </>
  );
}
