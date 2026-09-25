export function Mark({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 220 220" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M0 0H151L183 32V61H139V44H44V176H176V82H220V220H0Z" fill="currentColor"/><path d="M173 0H220V47Z" fill="#E04D26"/></svg>;
}
export function Brand({ docs = false, small = false }: { docs?: boolean; small?: boolean }) {
  return <span className={`brand ${small ? 'brand-small' : ''}`}><Mark/><span>Agari</span>{docs && <><i/><span className="brand-docs">Docs</span></>}</span>;
}
