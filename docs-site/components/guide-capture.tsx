'use client';

import { useId, useRef } from 'react';
import { ArrowUpRight, Maximize2, X } from 'lucide-react';
import { Brand } from './brand';
import { captures, type CaptureName } from '@/lib/captures';

export function GuideCapture({ name, caption }: { name: CaptureName; caption?: string }) {
  const capture = captures[name];
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const src = `/captures/${capture.file}`;
  const image = <div className="guide-capture">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={capture.alt} loading="lazy" />
  </div>;
  const notes = <div className="guide-capture-meta">
    <p className="guide-capture-state"><strong>Capture state:</strong> {capture.state}</p>
    <p className="guide-capture-date">Captured 23 September 2026.</p>
  </div>;

  return <figure className="guide-shot not-prose">
    <div className="guide-top"><span>{capture.title}</span><Brand small /></div>
    <button type="button" className="guide-expand" onClick={() => dialog.current?.showModal()} aria-label={`Expand screenshot: ${capture.title}`} aria-haspopup="dialog">
      {image}<span className="guide-zoom-hint"><Maximize2 size={15} aria-hidden="true" /> Click to expand</span>
    </button>
    <figcaption>{caption && <p>{caption}</p>}{notes}</figcaption>
    <dialog className="capture-dialog" ref={dialog} aria-labelledby={id} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="dialog-inner">
        <div className="dialog-heading"><h2 id={id}>{capture.title}</h2><Brand small /><button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Close screenshot"><X size={22} aria-hidden="true" /></button></div>
        {image}<div className="dialog-capture-notes">{notes}</div>
        <a className="raw-capture-link" href={src} target="_blank" rel="noreferrer">Open original capture <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
    </dialog>
  </figure>;
}
