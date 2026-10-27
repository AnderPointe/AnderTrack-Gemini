import React from 'react';
import { ArrowRight, ArrowUpRight, MapPinned, PackageCheck, Route, ShieldCheck, Truck, Warehouse } from 'lucide-react';

const capabilities = [
  { Icon: MapPinned, title: 'See the whole route.', text: 'Bring vehicle locations, shipment progress and driver context into one operational view.' },
  { Icon: Route, title: 'Keep dispatch moving.', text: 'Review assignments and dispatch requests alongside the drivers and vehicles that move them.' },
  { Icon: PackageCheck, title: 'Connect the last mile.', text: 'Follow delivery workflows with pickup, drop-off and proof of delivery tools.' },
];
const driverAppUrl = import.meta.env.VITE_DRIVER_APP_URL || '/driver';

export default function PublicWebsite({ onDemo }) {
  return <div className="at-public-site">
    <a className="at-entry-skip" href="#website-main">Skip to content</a>
    <header className="at-site-nav">
      <a className="at-site-wordmark" href="/website" aria-label="AnderTrack home">ANDER<span>TRACK</span></a>
      <nav aria-label="Main navigation"><a href="/hub">Customer Hub</a><a href="#platform">Platform</a><a href="#divisions">Divisions</a><a href={driverAppUrl}>Driver sign in <ArrowUpRight size={15}/></a></nav>
      <a className="at-site-outline" href="/operations?signup=1">Create account <ArrowRight size={16}/></a>
    </header>
    <main id="website-main" tabIndex={-1}>
      <section className="at-site-hero" aria-labelledby="at-site-heading">
        <div className="at-site-hero-copy"><p className="at-site-eyebrow">ONE PLATFORM. EVERY MILE.</p>
          <h1 id="at-site-heading">Your fleet.<br/>Your drivers.<br/><span>One connected view.</span></h1>
          <p className="at-site-lead">From dispatch to delivery, AnderTrack brings your people, vehicles and assignments together—so the next move is always clear.</p>
          <div className="at-site-actions"><a className="at-site-primary" href="/operations?signup=1">Get started <ArrowRight size={18}/></a><button className="at-site-primary" onClick={onDemo}>Explore the demo <ArrowRight size={18}/></button><a href={driverAppUrl}>Open driver app <ArrowUpRight size={18}/></a></div>
          <p className="at-site-disclosure"><ShieldCheck size={15}/> Interactive demo uses sample records.</p>
          <a className="at-site-concept-link" href="/concept">Preview the 3D command center concept <ArrowUpRight size={15}/></a>
        </div>
        <div className="at-site-brand-stage"><img src="/brand/andertrack-dark.png" width="1280" height="1280" alt="AnderTrack — Logistics, Freight, Delivery"/><div className="at-site-brand-caption"><span/> BUILT AROUND YOUR NEXT MOVE</div></div>
      </section>
      <section className="at-site-platform" id="platform" aria-labelledby="at-platform-heading">
        <p className="at-site-eyebrow">THE OPERATIONS WORKSPACE</p><h2 id="at-platform-heading">Less switching. More visibility.</h2>
        <div className="at-site-capabilities">{capabilities.map(({ Icon, title, text }) => <article key={title}><Icon size={25}/><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className="at-site-divisions" id="divisions" aria-labelledby="at-divisions-heading">
        <div><p className="at-site-eyebrow">ROOM FOR EVERY OPERATION</p><h2 id="at-divisions-heading">A shared foundation.<br/>Purpose-built workflows.</h2><p>Freight operations and Class C Local Services share a platform, with separate workflows for each division.</p></div>
        <div className="at-site-division-list">
          <article><Truck/><div><h3>Freight &amp; fleet</h3><p>Dispatch, vehicles, shipment visibility and driver workspaces.</p></div></article>
          <article><Warehouse/><div><h3>Warehouse &amp; yard</h3><p>Dedicated workspace navigation for warehouse and yard planning.</p></div></article>
          <article><PackageCheck/><div><h3>Class C Local Services</h3><p>Local courier workflows. Food delivery and passenger services are planned extensions.</p><span className="at-site-planned">Marketplace features in development</span></div></article>
        </div>
      </section>
      <section className="at-site-cta"><div><p className="at-site-eyebrow">TAKE A LOOK INSIDE</p><h2>Meet your next command center.</h2><p>Explore the sample workspace or sign in with your company account.</p></div><button className="at-site-primary" onClick={onDemo}>Explore AnderTrack <ArrowRight size={18}/></button></section>
    </main>
    <footer className="at-site-footer"><span>© {new Date().getFullYear()} ANDERTRACK</span><span>LOGISTICS · FREIGHT · DELIVERY</span><a href="/operations">Workspace sign in <ArrowUpRight size={14}/></a></footer>
  </div>;
}
