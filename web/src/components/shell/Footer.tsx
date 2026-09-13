import { DOCS_URL } from "@/lib/docs-url";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-row">
          <a href={DOCS_URL} data-cursor="hover">
            Docs
          </a>
        </div>
      </div>
    </footer>
  );
}
