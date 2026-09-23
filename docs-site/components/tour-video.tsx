'use client';

import { useRef, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { Brand } from './brand';

const chapters = [
  { at: 0, title: 'Browse baskets', text: 'Five PreStocks groups offer Predict and Cover with devnet test money. Hold opens a desk draft.' },
  { at: 4, title: 'Choose holdings', text: 'Pick a preset and adjust member weights and the cash sleeve without connecting a wallet.' },
  { at: 8, title: 'Set limits', text: 'The studio separates limits written on-chain for a future live desk from checks enforced by the desk runner.' },
  { at: 12, title: 'See the test read', text: 'Practice uses paper cash. A wallet message is needed before the app runs the read.' },
  { at: 16, title: 'Stop before signing', text: 'Creating a practice desk asks for a wallet message. This tour stops before a signature or transaction.' },
] as const;
const movie = '/videos/baskets-to-practice-2026-09-23.mp4';

export function TourVideo() {
  const player = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  return <figure className="walkthrough not-prose">
    <div className="guide-top"><span><Play size={14} aria-hidden="true" /> From a basket to a practice desk</span><Brand small /></div>
    <video ref={player} controls playsInline preload="metadata" poster="/captures/baskets-desktop-2026-09-23.jpg" aria-label="Agari public-screen tour from baskets to a practice desk" onTimeUpdate={event => setActive(chapters.reduce((index, chapter, next) => chapter.at <= event.currentTarget.currentTime ? next : index, 0))}>
      <source src={movie} type="video/mp4" />
      <track kind="captions" src="/videos/baskets-to-practice-2026-09-23.vtt" srcLang="en" label="English" default />
      Your browser cannot play the video. <a href={movie}>Download it.</a>
    </video>
    <figcaption>20 seconds · Silent, captioned tour edited from real public-app captures on 23 September 2026. No wallet was connected and no signature or transaction was recorded.</figcaption>
    <div className="video-chapters" aria-label="Video chapters">{chapters.map((chapter, index) => <button key={chapter.at} type="button" aria-current={active === index ? 'step' : undefined} onClick={() => { if (player.current) { player.current.currentTime = chapter.at; void player.current.play().catch(() => {}); } }}><span>0:{String(chapter.at).padStart(2, '0')}</span>{chapter.title}</button>)}</div>
    <details className="video-transcript"><summary>Read the tour</summary>{chapters.map(chapter => <p key={chapter.at}><strong>0:{String(chapter.at).padStart(2, '0')} · {chapter.title}.</strong> {chapter.text}</p>)}</details>
    <a className="raw-capture-link" href={movie} download><Download size={14} aria-hidden="true" /> Download video</a>
  </figure>;
}
