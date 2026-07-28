import { ChevronDown, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const foundationLinks = [
  ['/current-needs', 'Current Needs'], ['/campaigns', 'Campaigns'], ['/sponsor-a-family', 'Sponsor a Family'], ['/donate-items', 'Donate Items'], ['/request-assistance', 'Request Assistance']
] as const;
const networkLinks = [
  ['/membership', 'Membership'], ['/members', 'Member Directory'], ['/mentors', 'Mentors'], ['/businesses', 'Business Directory'], ['/products-services', 'Products & Services'], ['/chapters', 'Local Chapters'], ['/success-stories', 'Success Stories']
] as const;

function Dropdown({ label, items }: { label: string; items: readonly (readonly [string, string])[] }) {
  return <div className="nav-dropdown"><button type="button" className="nav-dropdown-trigger">{label}<ChevronDown size={15}/></button><div className="nav-dropdown-menu">{items.map(([to, text]) => <Link key={to} to={to}>{text}</Link>)}</div></div>;
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  return <>
    <div className="topbar"><div className="container topbar-inner"><span>Women Rise Legacy Network & Foundation</span><span>Heal. Build. Lead. Leave a Legacy.</span></div></div>
    <header className="site-header">
      <div className="container nav-wrap">
        <Link className="brand brand-logo" to="/" aria-label="Women Rise Legacy home"><img src="/assets/brand/logo-mark.webp" alt="Women Rise Legacy Network logo"/><span><strong>Women Rise</strong><small>Legacy Network</small></span></Link>
        <button className="menu-btn" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
        <nav className={open ? 'nav open' : 'nav'} onClick={() => setOpen(false)}>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/about">About</NavLink>
          <Dropdown label="Foundation" items={foundationLinks}/>
          <Dropdown label="Network" items={networkLinks}/>
          <NavLink to="/opportunities">Opportunities</NavLink>
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/resources">Resources</NavLink>
          <NavLink to="/impact">Impact</NavLink>
          {user ? <><Link to="/dashboard">Dashboard</Link><button className="link-button" onClick={() => signOut()}>Sign out</button></> : <Link to="/login">Member Login</Link>}
          <Link className="button button-small donate-nav-button" to="/donate">Donate</Link>
        </nav>
      </div>
    </header>
    <main><Outlet/></main>
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-intro"><Link className="brand footer-brand" to="/"><img src="/assets/brand/logo-mark.webp" alt=""/><span><strong>Women Rise</strong><small>Legacy Network</small></span></Link><p>Empowering women, strengthening families, and building a global legacy through leadership, mentorship, enterprise, and humanitarian action.</p></div>
        <div><h4>Network</h4><Link to="/membership">Membership</Link><Link to="/members">Members</Link><Link to="/mentors">Mentors</Link><Link to="/businesses">Businesses</Link><Link to="/chapters">Chapters</Link></div>
        <div><h4>Foundation</h4><Link to="/current-needs">Current Needs</Link><Link to="/campaigns">Campaigns</Link><Link to="/sponsor-a-family">Sponsor a Family</Link><Link to="/volunteer">Volunteer</Link><Link to="/partners">Partner With Us</Link></div>
        <div><h4>Grow & Connect</h4><Link to="/opportunities">Opportunities</Link><Link to="/resources">Resources</Link><Link to="/events">Events</Link><Link to="/success-stories">Success Stories</Link><Link to="/contact">Contact</Link></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} Women Rise Legacy Network. All rights reserved.</span><span>Privacy-first community and humanitarian platform.</span></div>
    </footer>
  </>;
}
