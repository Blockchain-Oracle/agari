'use client';

import { useRef, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { Brand } from './brand';

const tours = {
  basket: { title: 'Preview a connected basket call', file: 'connected-basket-ticket', duration: '16 seconds', poster: 'basket-quote-connected', note: 'The wallet was connected; the Down quote was previewed. Buy was not pressed and no order was submitted.', chapters: [
    { at: 0, title: 'Choose a basket', text: 'Open the AI Labs card from the basket catalogue.' },
    { at: 3.5, title: 'Open the live Window', text: 'Predict opens the current devnet Window and its ticket.' },
    { at: 8.8, title: 'Choose Down', text: 'The side changes while the live quote updates.' },
    { at: 11.2, title: 'Preview a quote', text: 'A 5 tUSDC amount shows cost, return and maximum loss before a buy.' },
  ] },
  portfolio: { title: 'Read a connected Portfolio', file: 'connected-portfolio', duration: '12 seconds', poster: 'portfolio-connected', note: 'The wallet was connected; balances and settled history were read. No deposit, withdrawal or claim was submitted.', chapters: [
    { at: 0, title: 'Read the balances', text: 'Ready to bet, wallet, Trading Balance and Private are distinct values.' },
    { at: 2.5, title: 'Open Trading Balance', text: 'The panel shows available funds and amounts held in grants.' },
    { at: 6.9, title: 'Open History', text: 'Settled rows show outcomes, receipt links and automatic payouts.' },
  ] },
  desk: { title: 'Inspect a practice desk', file: 'connected-practice-desk', duration: '20 seconds', poster: 'desk-overview-connected', note: 'A connected owner opened a paper practice desk. No new check, wallet signature or mainnet transaction was triggered.', chapters: [
    { at: 0, title: 'Read a practice desk', text: 'The value chart and next check describe a paper desk.' },
    { at: 4.9, title: 'Inspect Activity', text: 'Open the list of recorded decisions and refusals.' },
    { at: 11.3, title: 'Inspect Rules', text: 'The Rules tab separates program limits from checks run by the desk code.' },
    { at: 16.5, title: 'Read the promise', text: 'The footer describes the intended live record. Practice has no chain seal.' },
  ] },
} as const;

export function ConnectedWalkthrough({ name }: { name: keyof typeof tours }) {
  const tour = tours[name];
  const player = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const movie = `/videos/${tour.file}-2026-09-23.mp4`;
  return <figure className="walkthrough not-prose">
    <div className="guide-top"><span><Play size={14} aria-hidden="true" /> {tour.title}</span><Brand small /></div>
    <video ref={player} controls playsInline preload="metadata" poster={`/captures/${tour.poster}-2026-09-23.jpg`} aria-label={tour.title} onTimeUpdate={event => setActive(tour.chapters.reduce((index, chapter, next) => chapter.at <= event.currentTarget.currentTime ? next : index, 0))}>
      <source src={movie} type="video/mp4" />
      <track kind="captions" src={`/videos/${tour.file}-2026-09-23.vtt`} srcLang="en" label="English" default />
      Your browser cannot play the video. <a href={movie}>Download it.</a>
    </video>
    <figcaption>{tour.duration} · Real connected-browser recording on 23 September 2026, with account masked, pointer and detail zoom added. {tour.note}</figcaption>
    <div className="video-chapters" aria-label="Video chapters">{tour.chapters.map((chapter, index) => <button key={chapter.at} type="button" aria-current={active === index ? 'step' : undefined} onClick={() => { if (player.current) { player.current.currentTime = chapter.at; void player.current.play().catch(() => {}); } }}><span>0:{String(Math.floor(chapter.at)).padStart(2, '0')}</span>{chapter.title}</button>)}</div>
    <details className="video-transcript"><summary>Read the walkthrough</summary>{tour.chapters.map(chapter => <p key={chapter.at}><strong>0:{String(Math.floor(chapter.at)).padStart(2, '0')} · {chapter.title}.</strong> {chapter.text}</p>)}</details>
    <a className="raw-capture-link" href={movie} download><Download size={14} aria-hidden="true" /> Download video</a>
  </figure>;
}
