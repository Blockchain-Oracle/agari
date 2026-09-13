import { DEMO } from "./copy";

export function DemoVideo() {
  return (
    <figure className="demo-video-figure">
      <iframe
        className="demo-video"
        width={1280}
        height={720}
        src={DEMO.video.embedUrl}
        title={DEMO.video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        aria-describedby="demo-video-caption"
      />
      <figcaption id="demo-video-caption" className="demo-video-caption">
        <span>Markets, games, and agents. See Masayume in action.</span>
        <a href={DEMO.video.watchUrl} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>
      </figcaption>
    </figure>
  );
}
