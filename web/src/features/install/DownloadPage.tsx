import { AgariMark } from "@/components/shell";
import { INSTALL } from "./copy";
import { NativeDownloads } from "./NativeDownloads";

/**
 * `/download` — the page the app strip lands on, from the reference's `app/download/page.tsx` (`.dl-*` in
 * part-18.css), rebuilt for the native launch (09-25): the launch film beside the headline, then the Android APK (QR,
 * button, SHA-256) and the iPhone path, then the three points. Solana devnet throughout.
 */
export function DownloadPage() {
  return (
    <div className="dl">
      <section className="dl-hero">
        <div className="dl-copy">
          <div className="section-eyebrow dl-eyebrow">{INSTALL.eyebrow}</div>
          <h1 className="dl-title">
            {INSTALL.titleLead}
            <em>{INSTALL.titleEm}</em>
          </h1>
          <p className="dl-line">{INSTALL.line}</p>

          <ul className="dl-meta">
            {INSTALL.meta.map((item) => (
              <li key={item.label}>
                <b>{item.label}</b>
                <span>{item.note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dl-stage dl-film">
          <video src={INSTALL.film.src} poster={INSTALL.film.poster} autoPlay muted loop playsInline controls preload="metadata" aria-label={INSTALL.film.label} />
        </div>
      </section>

      <NativeDownloads />

      <section className="dl-points">
        {INSTALL.points.map((point) => (
          <article key={point.title}>
            <span className="dl-pt-mark">
              <AgariMark figure="currentColor" />
            </span>
            <h3>{point.title}</h3>
            <p>{point.body}</p>
          </article>
        ))}
      </section>

      <p className="dl-foot">{INSTALL.foot}</p>
    </div>
  );
}
