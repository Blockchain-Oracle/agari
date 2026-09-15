export function Mark({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 266 322" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M56 120 A 88 88 0 1 0 210 120" stroke="currentColor" fill="none" strokeWidth="34" strokeLinecap="round"/><circle cx="133" cy="62" r="30" fill="#E04D26"/></svg>;
}
export function Brand({ docs = false, small = false }: { docs?: boolean; small?: boolean }) {
  return <span className={`brand ${small ? 'brand-small' : ''}`}><Mark/><span>Agari</span>{docs && <><i/><span className="brand-docs">Docs</span></>}</span>;
}
