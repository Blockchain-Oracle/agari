import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarClock, ChartNoAxesCombined, ChevronRight, Landmark, MessagesSquare } from 'lucide-react';
import { Brand } from './brand';
import { appUrl } from '@/lib/site';
import mapStyles from './product-map.module.css';
export function AppLink({href,children}:{href:string;children:React.ReactNode}) {return <a href={appUrl(href)} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13} className="inline-icon"/></a>;}
export function WelcomeActions() {return <div className="welcome-actions not-prose"><Link href="/start/quickstart" className="primary-link">Start here <ArrowRight size={17}/></Link><Link href="/architecture/overview" className="secondary-link">How it works</Link></div>;}
const journeys=[{title:'Make your first call',description:'Choose a Window, make an Up or Down call, and follow it to settlement.',href:'/trading/first-trade',icon:ChartNoAxesCombined},{title:'Understand sessions and lanes',description:'NYSE hours, the Monday Gap and the 24/7 token lane.',href:'/trading/sessions-and-lanes',icon:CalendarClock},{title:'See how it fits together',description:'The order-book program, the vault and the off-chain actors.',href:'/architecture/overview',icon:Landmark},{title:'Ask Sensei for a read',description:'Stock- and position-aware, and it never gives investment advice.',href:'/explore/sensei',icon:MessagesSquare}];
export function JourneyList() {return <div className="journey-list not-prose">{journeys.map(({icon:Icon,...j})=><Link key={j.href} href={j.href} className="journey-row"><span className="journey-icon"><Icon size={22}/></span><span><strong>{j.title}</strong><span className="journey-description">{j.description}</span></span><ChevronRight size={19}/></Link>)}</div>;}
export function ProductMap() {
  return (
    <div className={`product-map not-prose ${mapStyles.root}`}>
      <div className={`asset-brand ${mapStyles.brand}`}><Brand small/></div>
      <nav className={`map-paths ${mapStyles.paths}`} aria-label="Explore Agari">
        {journeys.map(({icon:Icon,...journey},index)=>(
          <Link href={journey.href} key={journey.href} className={mapStyles.journey}>
            <span className={`map-icon ${mapStyles.icon}`}><Icon size={28} aria-hidden="true"/></span>
            <strong>{['Trading','Sessions','Architecture','Sensei'][index]}</strong>
          </Link>
        ))}
      </nav>
      <div className={`map-connector ${mapStyles.connector}`} aria-hidden="true"/>
      <Link className={`map-foundation ${mapStyles.foundation}`} href="/architecture/overview">
        <span className={mapStyles.foundationLabel}>All four share</span>
        <span className={mapStyles.foundationParts}>
          <span>Your wallet <b aria-hidden="true">·</b> Solana devnet</span>
          <span>On-chain settlement</span>
        </span>
        <ArrowRight size={18} className={mapStyles.foundationArrow} aria-hidden="true"/>
      </Link>
    </div>
  );
}
