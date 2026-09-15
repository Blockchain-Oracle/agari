import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEMO } from "./copy";

/**
 * The demo video, or the honest word that it is not recorded yet (D-097).
 *
 * The reference embeds a hosted video. Agari's walkthrough is captured on the running product during NYSE hours,
 * so until `public/video/agari-demo.mp4` exists this renders a plain notice in the same 16:9 box: no player, no
 * request, so no 404 in anyone's console and nothing that looks like a video when there is none. The check runs on
 * the server when the page renders (at build for a static build, so dropping the file in means a rebuild).
 */
const VIDEO_FILE = "agari-demo.mp4";
const CAPTIONS_FILE = "agari-demo.vtt";

const publicVideo = (file: string) => join(process.cwd(), "public", "video", file);

export function demoVideoAvailable(): boolean {
  return existsSync(publicVideo(VIDEO_FILE));
}

export function DemoVideo() {
  if (!demoVideoAvailable()) {
    return (
      <figure className="demo-video-figure">
        {/* `.demo-video-figure .demo-video` gives the player a block box on a fixed black ground. A notice is text, not
            video, so it re-centres itself and lets the page ground through, keeping the ink legible in both themes. */}
        <div className="demo-video" role="status" aria-describedby="demo-video-caption" style={{ display: "grid", placeItems: "center", background: "transparent" }}>
          <div style={{ display: "grid", gap: 10, padding: 24, textAlign: "center", justifyItems: "center" }}>
            <span className="demo-video-label" style={{ marginBottom: 0 }}>
              {DEMO.video.pendingEyebrow}
            </span>
            <span className="demo-h2" style={{ margin: 0 }}>
              {DEMO.video.pendingTitle}
            </span>
          </div>
        </div>
        <figcaption id="demo-video-caption" className="demo-video-caption">
          <span>{DEMO.video.pendingCaption}</span>
        </figcaption>
      </figure>
    );
  }

  const captions = existsSync(publicVideo(CAPTIONS_FILE));
  return (
    <figure className="demo-video-figure">
      <video className="demo-video" width={1280} height={720} controls playsInline preload="metadata" aria-describedby="demo-video-caption">
        <source src={`/video/${VIDEO_FILE}`} type="video/mp4" />
        {captions && <track kind="captions" src={`/video/${CAPTIONS_FILE}`} srcLang="en" label="English" default />}
      </video>
      <figcaption id="demo-video-caption" className="demo-video-caption">
        <span>{DEMO.video.caption}</span>
      </figcaption>
    </figure>
  );
}
