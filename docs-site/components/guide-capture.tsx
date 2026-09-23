'use client';

import { useId, useRef } from 'react';
import { ArrowUpRight, Maximize2, X } from 'lucide-react';
import { Brand } from './brand';
import { captures, type CaptureName } from '@/lib/captures';

export function GuideCapture({ name, caption }: { name: CaptureName; caption?: string }) {
  const capture = captures[name];
  const annotations = 'annotations' in capture ? capture.annotations : [];
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const arrowId = `guide-arrow-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const src = `/captures/${capture.file}`;
  const image = <div className="guide-capture">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={capture.alt} loading="lazy" />
    {annotations.length > 0 && <svg className="guide-annotations" viewBox="0 0 1130 798" aria-hidden="true">
      <defs><marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#c23f1c" /></marker></defs>
      {annotations.map((item, index) => {
        const x = item.x * 11.3, y = item.y * 7.98, toX = item.toX * 11.3, toY = item.toY * 7.98;
        const path = `M${x} ${y} Q${(x + toX) / 2} ${y} ${toX} ${toY}`;
        return <g key={`${index}-${item.label}`}>
          <path d={path} fill="none" stroke="#fffaf2" strokeWidth="8" />
          <path d={path} fill="none" stroke="#c23f1c" strokeWidth="3.5" markerEnd={`url(#${arrowId})`} />
          <circle cx={x} cy={y} r="19" fill="#c23f1c" stroke="#fffaf2" strokeWidth="3" />
          <text x={x} y={y + 7} textAnchor="middle" fill="white" fontSize="21" fontFamily="sans-serif" fontWeight="700">{index + 1}</text>
        </g>;
      })}
    </svg>}
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
    <figcaption>{caption && <p>{caption}</p>}{notes}{annotations.length > 0 && <ol className="annotation-legend">{annotations.map((item, index) => <li key={item.label}><span>{index + 1}</span>{item.label}</li>)}</ol>}</figcaption>
    <dialog className="capture-dialog" ref={dialog} aria-labelledby={id} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="dialog-inner">
        <div className="dialog-heading"><h2 id={id}>{capture.title}</h2><Brand small /><button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Close screenshot"><X size={22} aria-hidden="true" /></button></div>
        {image}<div className="dialog-capture-notes">{notes}</div>
        {annotations.length > 0 && <ol className="annotation-legend" style={{ padding: '10px 20px' }}>{annotations.map((item, index) => <li key={item.label}><span>{index + 1}</span>{item.label}</li>)}</ol>}
        <a className="raw-capture-link" href={src} target="_blank" rel="noreferrer">Open original capture <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
    </dialog>
  </figure>;
}
