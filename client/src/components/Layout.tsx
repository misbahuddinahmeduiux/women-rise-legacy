import { ChevronDown, ExternalLink, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { ApiStatus } from './ApiStatus';

type ChildLink = { label: string; to: string; enabled?: boolean; order?: number };
type NavigationItem = {
  type: 'link' | 'dropdown';
  label: string;
  to?: string;
  enabled?: boolean;
  order?: number;
  style?: 'normal' | 'button';
  children?: ChildLink[];
};
type FooterColumn = { title: string; links: ChildLink[] };

const defaultNavigation: NavigationItem[] = [
  { type: 'link', label: 'Home', to: '/', order: 10 },
  { type: 'link', label: 'About', to: '/about', order: 20 },
  { type: 'dropdown', label: 'Foundation', order: 30, children: [
    { to: '/current-needs', label: 'Current Needs', order: 10 }, { to: '/campaigns', label: 'Campaigns', order: 20 },
    { to: '/sponsor-a-family', label: 'Sponsor a Family', order: 30 }, { to: '/donate-items', label: 'Donate Items', order: 40 },
    { to: '/request-assistance', label: 'Request Assistance', order: 50 }
  ] },
  { type: 'dropdown', label: 'Network', order: 40, children: [
    { to: '/membership', label: 'Membership', order: 10 }, { to: '/members', label: 'Member Directory', order: 20 },
    { to: '/mentors', label: 'Mentors', order: 30 }, { to: '/businesses', label: 'Business Directory', order: 40 },
    { to: '/products-services', label: 'Products & Services', order: 50 }, { to: '/chapters', label: 'Local Chapters', order: 60 },
    { to: '/success-stories', label: 'Success Stories', order: 70 }
  ] },
  { type: 'link', label: 'Opportunities', to: '/opportunities', order: 50 },
  { type: 'link', label: 'Events', to: '/events', order: 60 },
  { type: 'link', label: 'Podcast', to: '/podcast', order: 70 },
  { type: 'link', label: 'Resources', to: '/resources', order: 80 },
  { type: 'link', label: 'Impact', to: '/impact', order: 90 },
  { type: 'link', label: 'Donate', to: '/donate', style: 'button', order: 100 }
];

const defaultFooterColumns: FooterColumn[] = [
  { title: 'Network', links: [{ to: '/membership', label: 'Membership' }, { to: '/members', label: 'Members' }, { to: '/mentors', label: 'Mentors' }, { to: '/businesses', label: 'Businesses' }, { to: '/chapters', label: 'Chapters' }] },
  { title: 'Foundation', links: [{ to: '/current-needs', label: 'Current Needs' }, { to: '/campaigns', label: 'Campaigns' }, { to: '/sponsor-a-family', label: 'Sponsor a Family' }, { to: '/volunteer', label: 'Volunteer' }, { to: '/partners', label: 'Partner With Us' }] },
  { title: 'Grow & Connect', links: [{ to: '/opportunities', label: 'Opportunities' }, { to: '/resources', label: 'Resources' }, { to: '/events', label: 'Events' }, { to: '/success-stories', label: 'Success Stories' }, { to: '/podcast', label: 'Podcast' }, { to: '/contact', label: 'Contact' }] }
];

function sorted<T extends { order?: number; enabled?: boolean }>(items: T[]) {
  return [...items].filter((item) => item.enabled !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function SmartLink({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  if (/^https?:\/\//i.test(to)) return <a className={className} href={to} target="_blank" rel="noreferrer" onClick={onClick}>{children}</a>;
  return <Link className={className} to={to} onClick={onClick}>{children}</Link>;
}

function Brand({ general, compact = false, footer = false }: { general: any; compact?: boolean; footer?: boolean }) {
  return <Link className={`brand brand-logo ${compact ? 'compact' : ''} ${footer ? 'footer-brand' : ''}`} to="/" aria-label={`${general.organizationName} home`}>
    <span className="brand-mark"><img src={general.logoUrl || '/assets/brand/logo-mark.webp'} onError={(event) => { event.currentTarget.src = '/assets/brand/logo-mark.webp'; }} alt={`${general.organizationName} logo`}/></span>
    <span className="brand-copy"><strong>{general.brandPrimary || 'Women Rise'}</strong><small>{general.brandSecondary || 'Legacy Network'}</small></span>
  </Link>;
}

function Dropdown({ item, onNavigate }: { item: NavigationItem; onNavigate: () => void }) {
  const children = sorted(item.children || []);
  if (!children.length) return null;
  return <details className="nav-dropdown"><summary className="nav-dropdown-trigger">{item.label}<ChevronDown size={15}/></summary><div className="nav-dropdown-menu">{children.map((child) => <SmartLink key={`${child.to}-${child.label}`} to={child.to} onClick={onNavigate}>{child.label}</SmartLink>)}</div></details>;
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const [general, setGeneral] = useState<any>({ organizationName: 'Women Rise Legacy Network', brandPrimary: 'Women Rise', brandSecondary: 'Legacy Network', tagline: 'Heal. Build. Lead. Leave a Legacy.', footerDescription: 'Empowering women, strengthening families, and building a global legacy through leadership, mentorship, enterprise, and humanitarian action.', copyright: 'Women Rise Legacy Network. All rights reserved.', footerNote: 'Privacy-first community and humanitarian platform.', logoUrl: '/assets/brand/logo-mark.webp' });
  const [announcement, setAnnouncement] = useState<any>({ enabled: false, text: '', linkLabel: '', linkUrl: '' });
  const [navigation, setNavigation] = useState<NavigationItem[]>(defaultNavigation);
  const [footerColumns, setFooterColumns] = useState<FooterColumn[]>(defaultFooterColumns);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => { setOpen(false); window.scrollTo({ top: 0, behavior: 'auto' }); }, [location.pathname]);
  useEffect(() => {
    api<Record<string, any>>('/phase4/content').then((content) => {
      if (content['site.general']) setGeneral((current: any) => ({ ...current, ...content['site.general'] }));
      if (content['site.announcement']) setAnnouncement((current: any) => ({ ...current, ...content['site.announcement'] }));
      if (Array.isArray(content['site.navigation']?.items) && content['site.navigation'].items.length) setNavigation(content['site.navigation'].items);
      if (Array.isArray(content['site.footer']?.columns) && content['site.footer'].columns.length) setFooterColumns(content['site.footer'].columns);
    }).catch(() => undefined);
  }, []);

  const closeMenu = () => setOpen(false);

  return <div className={isAdmin ? 'app-shell admin-route-shell' : 'app-shell'}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <ApiStatus/>
    {!isAdmin && <div className={`topbar ${announcement.enabled ? 'announcement-active' : ''}`}><div className="container topbar-inner"><span>{announcement.enabled ? announcement.text : `${general.organizationName} & Foundation`}</span>{announcement.enabled && announcement.linkUrl ? <SmartLink to={announcement.linkUrl}>{announcement.linkLabel || 'Learn more'}</SmartLink> : <span>{general.tagline}</span>}</div></div>}
    <header className={`site-header ${isAdmin ? 'admin-site-header' : ''}`}>
      <div className={`container nav-wrap ${isAdmin ? 'admin-header-wrap' : ''}`}>
        <Brand general={general} compact={isAdmin}/>
        {isAdmin ? <div className="admin-header-actions"><Link className="admin-header-link" to="/"><ExternalLink/>View website</Link><Link className="admin-header-link" to="/dashboard"><LayoutDashboard/>Member dashboard</Link><button className="admin-header-link" onClick={() => signOut()}><LogOut/>Sign out</button></div> : <>
          <button className="menu-btn" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
          <nav className={open ? 'nav open' : 'nav'} aria-label="Main navigation">
            {sorted(navigation).map((item) => item.type === 'dropdown'
              ? <Dropdown key={`${item.type}-${item.label}`} item={item} onNavigate={closeMenu}/>
              : item.to ? <NavLink className={item.style === 'button' ? 'button button-small donate-nav-button' : undefined} key={`${item.type}-${item.label}-${item.to}`} to={item.to} onClick={closeMenu}>{item.label}</NavLink> : null)}
            {user ? <><Link to="/dashboard" onClick={closeMenu}>Dashboard</Link><button className="link-button" onClick={() => { closeMenu(); void signOut(); }}>Sign out</button></> : <Link to="/login" onClick={closeMenu}>Member Login</Link>}
          </nav>
        </>}
      </div>
    </header>
    <main id="main-content" tabIndex={-1}><Outlet/></main>
    {!isAdmin && <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-intro"><Brand general={general} footer/><p>{general.footerDescription}</p><div className="footer-contact-details">{general.supportEmail && <a href={`mailto:${general.supportEmail}`}>{general.supportEmail}</a>}{general.phone && <a href={`tel:${general.phone}`}>{general.phone}</a>}{general.address&&<span>{general.address}</span>}</div><div className="footer-social-links">{['facebook','instagram','linkedin','youtube'].filter(key=>general[key]).map(key=><a href={general[key]} target="_blank" rel="noreferrer" key={key}>{key}</a>)}</div></div>
        {footerColumns.map((column) => <div key={column.title}><h4>{column.title}</h4>{sorted(column.links || []).map((item) => <SmartLink key={`${item.to}-${item.label}`} to={item.to}>{item.label}</SmartLink>)}</div>)}
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} {general.copyright}</span><span>{general.footerNote || 'Privacy-first community and humanitarian platform.'}</span></div>
    </footer>}
  </div>;
}
