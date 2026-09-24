import { DEMO } from "./copy";

/**
 * The demo video, hosted on YouTube as the reference hosts its own. `youtube-nocookie` keeps the embed from setting
 * tracking cookies until the viewer presses play, and the caption links out for anyone whose browser blocks frames.
 */
export const DEMO_VIDEO_ID = "iPtmue-eyIc";
export const DEMO_VIDEO_URL = `https://youtu.be/${DEMO_VIDEO_ID}`;

export function DemoVideo() {
  return (
    <figure className="demo-video-figure">
      <iframe
        className="demo-video"
        src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0&modestbranding=1`}
        title={DEMO.video.title}
        width={1280}
        height={720}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        aria-describedby="demo-video-caption"
      />
      <figcaption id="demo-video-caption" className="demo-video-caption">
        <span>{DEMO.video.caption}</span>
        <a href={DEMO_VIDEO_URL} target="_blank" rel="noopener noreferrer">
          {DEMO.video.watch}
        </a>
      </figcaption>
    </figure>
  );
}
