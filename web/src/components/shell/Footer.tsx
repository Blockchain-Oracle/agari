import { DOCS_URL } from "@/lib/docs-url";

/** S25: where the prices come from, in one factual line; every print is checked by the program before a Window settles. */
const CREDIT = "Prices from PreStocks, Pyth, RedStone and Switchboard · every print verified on Solana";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-row">
          <span className="footer-credit">{CREDIT}</span>
          <a href={DOCS_URL} data-cursor="hover">
            Docs
          </a>
        </div>
      </div>
    </footer>
  );
}
