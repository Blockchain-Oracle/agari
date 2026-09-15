import Link from 'next/link';
import { Brand } from '@/components/brand';
export default function NotFound() {return <main id="main-content" className="not-found"><Link href="/"><Brand docs/></Link><h1>This page took a different path.</h1><p>Find a guide from the docs home, or use search to look for a feature.</p><Link className="primary-link" href="/">Back to the docs</Link></main>;}
