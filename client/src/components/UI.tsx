import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHero({ eyebrow, title, text, children }: { eyebrow?: string; title: string; text: string; children?: ReactNode }) {
  return <section className="page-hero"><div className="container narrow">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{text}</p>{children && <div className="hero-actions">{children}</div>}</div></section>;
}
export function SectionHeading({ eyebrow, title, text, centered = false }: { eyebrow?: string; title: string; text?: string; centered?: boolean }) {
  return <div className={`section-heading ${centered ? 'centered' : ''}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{text && <p>{text}</p>}</div>;
}
export function Progress({ value, max }: { value: number; max: number }) { const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0; return <div><div className="progress"><span style={{ width: `${percent}%` }}/></div><small>{percent}% funded</small></div>; }
export function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><h3>{title}</h3><p>{text}</p></div>; }
export function Loader() { return <div className="loader" aria-label="Loading"/>; }
export function ErrorBox({ message }: { message: string }) { return <div className="notice error">{message}</div>; }
export function SuccessBox({ message }: { message: string }) { return <div className="notice success">{message}</div>; }
export function BackLink({ to, children }: { to: string; children: ReactNode }) { return <Link className="back-link" to={to}>← {children}</Link>; }
